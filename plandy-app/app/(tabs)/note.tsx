import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  Modal,
} from "react-native";

import { useFocusEffect } from "expo-router";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";
import { getSubjects } from "@/src/subjectService";
import { auth, db } from "@/src/firebase";
import { getAppUser, subscribeAppUserChange } from "../../src/appSession";
import { getIncorrectNoteGroupsByUser } from "@/src/quizService";
import SubjectDropdown from "../../components/SubjectDropdown";

type Subject = {
  id: string;
  title: string;
  goal?: string;
  progress?: number;
};

type IncorrectNoteItem = {
  question_index: number;
  question: string;
  user_answer_index: number;
  user_answer_text: string;
  correct_answer_index: number;
  correct_answer_text: string;
  explanation: string;
  is_review_needed: boolean;
};

type IncorrectNoteGroup = {
  result_id?: string;
  quiz_id: string;
  quiz_title: string;
  solved_at: string;
  incorrect_count: number;
  items: IncorrectNoteItem[];
};

export default function NoteScreen() {
  const [userId, setUserId] = useState<string | null>(null);

  const [mode, setMode] = useState<"write" | "search">("write");
  const [searchTab, setSearchTab] = useState<"note" | "incorrect">("note");

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchSubject, setSearchSubject] = useState<Subject | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [content, setContent] = useState("");

  const [notes, setNotes] = useState<any[]>([]);
  const [incorrectNoteGroups, setIncorrectNoteGroups] = useState<IncorrectNoteGroup[]>([]);
  const [isLoadingIncorrectNotes, setIsLoadingIncorrectNotes] = useState(false);

  const [isEditNoteModalVisible, setIsEditNoteModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  const [isDeleteNoteModalVisible, setIsDeleteNoteModalVisible] =
    useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const getAppUserIdOrNull = useCallback(() => {
    const appUser = getAppUser();

    if (appUser?.uid) {
      return String(appUser.uid);
    }

    if (appUser?.id) {
      return String(appUser.id);
    }

    if (appUser?.user_id) {
      return String(appUser.user_id);
    }

    if (appUser?.userId) {
      return String(appUser.userId);
    }

    return null;
  }, []);

  const clearUserData = () => {
    setSubjects([]);
    setNotes([]);
    setSelectedSubject(null);
    setSearchSubject(null);
  };

  const syncUserId = useCallback(() => {
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      setUserId(firebaseUser.uid);
      return;
    }

    const appUserId = getAppUserIdOrNull();

    if (appUserId) {
      setUserId(appUserId);
      return;
    }

    setUserId(null);
    clearUserData();
  }, [getAppUserIdOrNull]);

  useEffect(() => {
    const unsubscribeFirebase = onAuthStateChanged(auth, () => {
      syncUserId();
    });

    const unsubscribeAppUser = subscribeAppUserChange(() => {
      syncUserId();
    });

    syncUserId();

    return () => {
      unsubscribeFirebase();
      unsubscribeAppUser();
    };
  }, [syncUserId]);

  const fetchSubjects = useCallback(async () => {
    if (!userId) {
      setSubjects([]);
      return [];
    }

    try {
      const data = await getSubjects(userId);
      setSubjects(data as Subject[]);
      return data as Subject[];
    } catch (error) {
      void error;
      Alert.alert("오류", "과목 목록 조회 실패");
      return [];
    }
  }, [userId]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const fetchNotesBySubject = async (
    targetSubject: Subject,
    showEmptyAlert: boolean = true
  ) => {
    if (!userId) {
      if (showEmptyAlert) {
        Alert.alert("오류", "로그인 후 노트를 조회할 수 있습니다.");
      }
      return;
    }

    try {
      const q = query(
        collection(db, "notes"),
        where("user_id", "==", userId),
        where("subject_id", "==", targetSubject.id)
      );

      const querySnapshot = await getDocs(q);

      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setNotes(data);
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 조회 실패");
    }
  };

  useFocusEffect(
    useCallback(() => {
      syncUserId();
      fetchSubjects();
    }, [fetchSubjects, syncUserId])
  );

  const fetchIncorrectNoteGroups = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 오답노트를 조회할 수 있습니다.");
      return;
    }

    try {
      setIsLoadingIncorrectNotes(true);
      const groups = (await getIncorrectNoteGroupsByUser(userId)) as IncorrectNoteGroup[];
      setIncorrectNoteGroups(groups);
    } catch (error) {
      void error;
      Alert.alert("오류", "오답노트 조회 실패");
      setIncorrectNoteGroups([]);
    } finally {
      setIsLoadingIncorrectNotes(false);
    }
  };

  const handleAddNote = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 작성할 수 있습니다.");
      return;
    }

    if (subjects.length === 0) {
      Alert.alert("과목 필요", "먼저 과목을 등록해주세요.");
      return;
    }

    if (!selectedSubject || !noteTitle || !content) {
      Alert.alert("오류", "과목, 노트 제목, 노트 내용을 모두 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "notes"), {
        user_id: userId,
        subject_id: selectedSubject.id,
        title: noteTitle,
        content: content,
        updated_at: new Date(),
      });

      Alert.alert("성공", "노트가 저장되었습니다.");

      setSelectedSubject(null);
      setNoteTitle("");
      setContent("");
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 저장 실패");
    }
  };

  const handleSearchNotes = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 조회할 수 있습니다.");
      return;
    }

    if (!searchSubject) {
      Alert.alert("오류", "조회할 과목을 선택해주세요.");
      return;
    }

    await fetchNotesBySubject(searchSubject);
  };

  const getSubjectTitle = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId);
    return subject ? subject.title : "과목 정보 없음";
  };

  const getSubjectById = (subjectId: string) => {
    return subjects.find((item) => item.id === subjectId) || null;
  };

  const handleOpenEditNoteModal = async (note: any) => {
    const latestSubjects = await fetchSubjects();

    setEditingNoteId(note.id);
    setEditNoteTitle(note.title || "");
    setEditContent(note.content || "");
    setEditSubject(
      latestSubjects.find((subject) => subject.id === note.subject_id) ||
        getSubjectById(note.subject_id)
    );
    setIsEditNoteModalVisible(true);
  };

  const handleUpdateNote = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 수정할 수 있습니다.");
      return;
    }

    if (subjects.length === 0) {
      Alert.alert("과목 필요", "먼저 과목을 등록해주세요.");
      return;
    }

    if (!editingNoteId || !editSubject || !editNoteTitle || !editContent) {
      Alert.alert("오류", "과목, 노트 제목, 노트 내용을 모두 입력해주세요.");
      return;
    }

    try {
      const noteRef = doc(db, "notes", editingNoteId);

      await updateDoc(noteRef, {
        subject_id: editSubject.id,
        title: editNoteTitle,
        content: editContent,
        updated_at: new Date(),
      });

      Alert.alert("성공", "노트가 수정되었습니다.");

      setIsEditNoteModalVisible(false);
      setEditingNoteId(null);
      setEditSubject(null);
      setEditNoteTitle("");
      setEditContent("");

      if (searchSubject) {
        fetchNotesBySubject(searchSubject, false);
      }
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 수정 실패");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, "notes", noteId));

      setNotes((prevNotes) =>
        prevNotes.filter((note) => note.id !== noteId)
      );

      setIsDeleteNoteModalVisible(false);
      setDeletingNoteId(null);

      Alert.alert("성공", "노트가 삭제되었습니다.");
    } catch (error) {
      void error;
      Alert.alert("오류", "노트 삭제 실패");
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 삭제할 수 있습니다.");
      return;
    }

    setDeletingNoteId(noteId);
    setIsDeleteNoteModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>노트 관리</Text>

      {!userId && (
        <Text style={styles.loginNotice}>
          로그인 후 노트 작성 및 조회가 가능합니다.
        </Text>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, mode === "write" && styles.activeTabButton]}
          onPress={() => setMode("write")}
        >
          <Text
            style={[
              styles.tabButtonText,
              mode === "write" && styles.activeTabButtonText,
            ]}
          >
            노트 작성
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, mode === "search" && styles.activeTabButton]}
          onPress={() => setMode("search")}
        >
          <Text
            style={[
              styles.tabButtonText,
              mode === "search" && styles.activeTabButtonText,
            ]}
          >
            노트 조회
          </Text>
        </TouchableOpacity>
      </View>

      {mode === "write" && (
        <View>
          <Text style={styles.sectionTitle}>노트 작성</Text>

          <SubjectDropdown
            subjects={subjects}
            selectedSubjectId={selectedSubject?.id}
            placeholder="과목 선택"
            disabled={!userId || subjects.length === 0}
            onOpen={fetchSubjects}
            onSelect={(subject) => setSelectedSubject(subject as Subject)}
          />

          {userId && subjects.length === 0 && (
            <Text style={styles.subjectNotice}>
              먼저 과목을 등록해주세요.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="노트 제목"
            value={noteTitle}
            onChangeText={setNoteTitle}
          />

          <TextInput
            style={styles.noteInput}
            placeholder="학습 노트 내용을 입력하세요"
            value={content}
            onChangeText={setContent}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.button,
              (!userId || subjects.length === 0) && styles.disabledButton,
            ]}
            onPress={handleAddNote}
            disabled={!userId || subjects.length === 0}
          >
            <Text style={styles.buttonText}>저장하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "search" && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>과목별 노트 조회</Text>

          <View style={styles.searchTabContainer}>
            <TouchableOpacity
              style={[
                styles.searchTabButton,
                searchTab === "note" && styles.activeSearchTabButton,
              ]}
              onPress={() => setSearchTab("note")}
            >
              <Text
                style={[
                  styles.searchTabText,
                  searchTab === "note" && styles.activeSearchTabText,
                ]}
              >
                학습 노트
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.searchTabButton,
                searchTab === "incorrect" && styles.activeSearchTabButton,
              ]}
              onPress={() => {
                setSearchTab("incorrect");
                fetchIncorrectNoteGroups();
              }}
            >
              <Text
                style={[
                  styles.searchTabText,
                  searchTab === "incorrect" && styles.activeSearchTabText,
                ]}
              >
                오답노트
              </Text>
            </TouchableOpacity>
          </View>

          {searchTab === "note" ? (
            <>
              <SubjectDropdown
                subjects={subjects}
                selectedSubjectId={searchSubject?.id}
                placeholder="조회할 과목 선택"
                disabled={!userId || subjects.length === 0}
                onOpen={fetchSubjects}
                onSelect={(subject) => {
                  setSearchSubject(subject as Subject);
                  setNotes([]);
                }}
              />

              {userId && subjects.length === 0 && (
                <Text style={styles.subjectNotice}>
                  먼저 과목을 등록해주세요.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.searchButton,
                  (!userId || subjects.length === 0) && styles.disabledButton,
                ]}
                onPress={handleSearchNotes}
                disabled={!userId || subjects.length === 0}
              >
                <Text style={styles.buttonText}>조회하기</Text>
              </TouchableOpacity>

              <FlatList
                data={notes}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>조회된 노트가 없습니다.</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <Text style={styles.subject}>
                      {getSubjectTitle(item.subject_id)}
                    </Text>

                    <Text style={styles.noteTitle}>{item.title}</Text>

                    <Text style={styles.noteText}>{item.content}</Text>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleOpenEditNoteModal(item)}
                      >
                        <Text style={styles.editButtonText}>수정</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteNote(item.id)}
                      >
                        <Text style={styles.deleteButtonText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </>
          ) : (
            <View style={styles.incorrectNotesContainer}>
              <TouchableOpacity
                style={[
                  styles.searchButton,
                  !userId && styles.disabledButton,
                ]}
                onPress={fetchIncorrectNoteGroups}
                disabled={!userId}
              >
                <Text style={styles.buttonText}>
                  {isLoadingIncorrectNotes ? "로딩 중..." : "새로고침"}
                </Text>
              </TouchableOpacity>

              <FlatList
                data={incorrectNoteGroups}
                keyExtractor={(group, index) =>
                  `${group.result_id || group.quiz_id}-${group.solved_at || index}`
                }
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {isLoadingIncorrectNotes
                      ? "오답노트를 불러오는 중..."
                      : "저장된 오답노트가 없습니다."}
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.incorrectGroupCard}>
                    <View style={styles.incorrectGroupHeader}>
                      <Text style={styles.quizTitleText}>{item.quiz_title}</Text>
                      <Text style={styles.dateText}>{item.solved_at}</Text>
                    </View>
                    <Text style={styles.incorrectSummaryText}>
                      오답 {item.incorrect_count}개
                    </Text>

                    {item.items.map((incorrect, idx) => (
                      <View key={`${item.quiz_id}-${incorrect.question_index}-${idx}`} style={styles.incorrectCard}>
                        <Text style={styles.questionNumber}>
                          문제 {incorrect.question_index + 1}
                        </Text>
                        <Text style={styles.questionContentText}>
                          {incorrect.question}
                        </Text>
                        <Text style={styles.answerInfoText}>
                          내 답: {incorrect.user_answer_text}
                        </Text>
                        <Text style={styles.answerInfoText}>
                          정답: {incorrect.correct_answer_text}
                        </Text>
                        {incorrect.explanation ? (
                          <View style={styles.explanationSection}>
                            <Text style={styles.explanationTitle}>해설</Text>
                            <Text style={styles.explanationText}>
                              {incorrect.explanation}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.reviewNeededTextBlock}>
                          {incorrect.is_review_needed ? "복습 필요" : "복습 불필요"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              />
            </View>
          )}
        </View>
      )}

      <Modal
        visible={isEditNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditNoteModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>노트 수정</Text>

            <SubjectDropdown
              subjects={subjects}
              selectedSubjectId={editSubject?.id}
              placeholder="과목 선택"
              disabled={subjects.length === 0}
              onOpen={fetchSubjects}
              onSelect={(subject) => setEditSubject(subject as Subject)}
            />

            {subjects.length === 0 && (
              <Text style={styles.subjectNotice}>
                먼저 과목을 등록해주세요.
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="노트 제목"
              value={editNoteTitle}
              onChangeText={setEditNoteTitle}
            />

            <TextInput
              style={styles.noteInput}
              placeholder="학습 노트 내용을 입력하세요"
              value={editContent}
              onChangeText={setEditContent}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.button,
                subjects.length === 0 && styles.disabledButton,
              ]}
              onPress={handleUpdateNote}
              disabled={subjects.length === 0}
            >
              <Text style={styles.buttonText}>수정 완료</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsEditNoteModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDeleteNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsDeleteNoteModalVisible(false);
          setDeletingNoteId(null);
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.deleteModalContainer}>
            <Text style={styles.modalTitle}>노트 삭제</Text>

            <Text style={styles.deleteModalText}>
              이 노트를 삭제하시겠습니까?
            </Text>

            <View style={styles.deleteModalButtonRow}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => {
                  setIsDeleteNoteModalVisible(false);
                  setDeletingNoteId(null);
                }}
              >
                <Text style={styles.deleteCancelButtonText}>취소</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={() => {
                  if (deletingNoteId) {
                    deleteNote(deletingNoteId);
                  }
                }}
              >
                <Text style={styles.deleteConfirmButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  loginNotice: {
    color: "#EF4444",
    marginBottom: 15,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
    padding: 4,
  },

  tabButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  activeTabButton: {
    backgroundColor: "#ff6a92",
  },

  tabButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6B7280",
  },

  activeTabButtonText: {
    color: "#fff",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    justifyContent: "center",
  },

  selectedText: {
    fontSize: 16,
    color: "#000",
  },

  placeholderText: {
    fontSize: 16,
    color: "#9CA3AF",
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    height: 160,
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: "#ff6a92",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },

  searchButton: {
    backgroundColor: "#ff6a92",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  searchContainer: {
    flex: 1,
  },

  searchTabContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  searchTabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },

  searchTabText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "700",
  },

  activeSearchTabButton: {
    backgroundColor: "#ff6a92",
    borderColor: "#ff6a92",
  },

  activeSearchTabText: {
    color: "#fff",
  },

  incorrectNotesContainer: {
    flex: 1,
  },

  incorrectGroupCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },

  incorrectGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  incorrectSummaryText: {
    color: "#6B7280",
    fontSize: 14,
    marginBottom: 12,
  },

  incorrectCard: {
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  answerInfoText: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 4,
  },

  reviewNeededTextBlock: {
    marginTop: 10,
    color: "#92400e",
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },

  subject: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
  },

  noteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },

  noteText: {
    fontSize: 16,
    lineHeight: 22,
  },

  actionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },

  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#F2C75C",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  editButtonText: {
    color: "#F2C75C",
    fontWeight: "bold",
  },

  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  deleteButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
  },

  cancelButton: {
    backgroundColor: "#F8F8FA",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "bold",
  },

  emptyText: {
    color: "#6B7280",
    marginTop: 10,
  },

  subjectNotice: {
    color: "#9a3412",
    marginTop: -8,
    marginBottom: 12,
    fontSize: 14,
  },

  disabledButton: {
    backgroundColor: "#9CA3AF",
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalContainer: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
  },

  subjectItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  subjectItemText: {
    fontSize: 16,
  },

  closeButton: {
    marginTop: 15,
    backgroundColor: "#ff6a92",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteModalContainer: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
  },

  deleteModalText: {
    fontSize: 16,
    marginBottom: 20,
    color: "#2B2B2B",
  },

  deleteModalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  deleteCancelButton: {
    flex: 1,
    backgroundColor: "#F8F8FA",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteCancelButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteConfirmButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteConfirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  incorrectItemsContainer: {
    flex: 1,
    marginTop: 12,
  },

  incorrectItemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },

  incorrectItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  quizTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2B2B2B",
    flex: 1,
  },

  dateText: {
    fontSize: 12,
    color: "#6B7280",
  },

  questionNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ff6a92",
    marginBottom: 6,
  },

  questionContentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2B2B2B",
    lineHeight: 21,
    marginBottom: 10,
  },

  optionsContainer: {
    marginBottom: 10,
  },

  incorrectItemOption: {
    backgroundColor: "#F8F8FA",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  correctAnswerOption: {
    backgroundColor: "#dcfce7",
    borderColor: "#22C55E",
  },

  wrongAnswerOption: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },

  optionNumberText: {
    fontSize: 13,
    color: "#2B2B2B",
    lineHeight: 19,
  },

  correctAnswerText: {
    color: "#22C55E",
    fontWeight: "700",
  },

  wrongAnswerText: {
    color: "#EF4444",
    fontWeight: "700",
  },

  correctLabel: {
    color: "#22C55E",
    fontWeight: "700",
    fontSize: 12,
  },

  wrongLabel: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 12,
  },

  explanationSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  explanationTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2B2B2B",
    marginBottom: 4,
  },

  explanationText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },

  reviewNeededBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 10,
    alignSelf: "flex-start",
  },

  reviewNeededText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },
});
