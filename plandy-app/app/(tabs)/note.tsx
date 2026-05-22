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
import { getAppUser, subscribeAppUserChange } from "../../src/appSession";

const firebase = require("../../src/firebase");
const db = firebase.db;
const auth = firebase.auth;

type Subject = {
  id: string;
  title: string;
  goal?: string;
  progress?: number;
};

export default function NoteScreen() {
  const [userId, setUserId] = useState<string | null>(null);

  const [mode, setMode] = useState<"write" | "search">("write");

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [searchSubject, setSearchSubject] = useState<Subject | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [content, setContent] = useState("");

  const [notes, setNotes] = useState<any[]>([]);

  const [isWriteSubjectModalVisible, setIsWriteSubjectModalVisible] =
    useState(false);
  const [isSearchSubjectModalVisible, setIsSearchSubjectModalVisible] =
    useState(false);

  const [isEditNoteModalVisible, setIsEditNoteModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] =
    useState(false);

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

  const fetchSubjects = async () => {
    if (!userId) {
      setSubjects([]);
      return;
    }

    try {
      const data = await getSubjects(userId);
      setSubjects(data as Subject[]);
    } catch (error) {
      console.log(error);
      Alert.alert("오류", "과목 목록 조회 실패");
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [userId]);

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
      console.log(error);
      Alert.alert("오류", "노트 조회 실패");
    }
  };

  useFocusEffect(
    useCallback(() => {
      syncUserId();
      fetchSubjects();

      if (searchSubject) {
        fetchNotesBySubject(searchSubject, false);
      }
    }, [syncUserId, userId, searchSubject])
  );

  const handleAddNote = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 작성할 수 있습니다.");
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
      console.log(error);
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
    return subject ? subject.title : subjectId;
  };

  const getSubjectById = (subjectId: string) => {
    return subjects.find((item) => item.id === subjectId) || null;
  };

  const handleOpenEditNoteModal = async (note: any) => {
    await fetchSubjects();

    setEditingNoteId(note.id);
    setEditNoteTitle(note.title || "");
    setEditContent(note.content || "");
    setEditSubject(getSubjectById(note.subject_id));
    setIsEditNoteModalVisible(true);
  };

  const handleUpdateNote = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 후 노트를 수정할 수 있습니다.");
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
      console.log(error);
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
      console.log(error);
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

          <TouchableOpacity
            style={styles.input}
            onPress={async () => {
              if (!userId) {
                Alert.alert("오류", "로그인 후 과목을 선택할 수 있습니다.");
                return;
              }

              await fetchSubjects();
              setIsWriteSubjectModalVisible(true);
            }}
          >
            <Text
              style={selectedSubject ? styles.selectedText : styles.placeholderText}
            >
              {selectedSubject ? selectedSubject.title : "과목 선택"}
            </Text>
          </TouchableOpacity>

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

          <TouchableOpacity style={styles.button} onPress={handleAddNote}>
            <Text style={styles.buttonText}>저장하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === "search" && (
        <View style={styles.searchContainer}>
          <Text style={styles.sectionTitle}>과목별 노트 조회</Text>

          <TouchableOpacity
            style={styles.input}
            onPress={async () => {
              if (!userId) {
                Alert.alert("오류", "로그인 후 과목을 선택할 수 있습니다.");
                return;
              }

              await fetchSubjects();
              setIsSearchSubjectModalVisible(true);
            }}
          >
            <Text
              style={searchSubject ? styles.selectedText : styles.placeholderText}
            >
              {searchSubject ? searchSubject.title : "조회할 과목 선택"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearchNotes}
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
        </View>
      )}

      <Modal
        visible={isWriteSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWriteSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>등록된 과목이 없습니다.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.subjectItem}
                  onPress={() => {
                    setSelectedSubject(item);
                    setIsWriteSubjectModalVisible(false);
                  }}
                >
                  <Text style={styles.subjectItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsWriteSubjectModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isSearchSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSearchSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>조회할 과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>등록된 과목이 없습니다.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.subjectItem}
                  onPress={() => {
                    setSearchSubject(item);
                    setIsSearchSubjectModalVisible(false);
                  }}
                >
                  <Text style={styles.subjectItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsSearchSubjectModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isEditNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditNoteModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>노트 수정</Text>

            <TouchableOpacity
              style={styles.input}
              onPress={async () => {
                await fetchSubjects();
                setIsEditSubjectModalVisible(true);
              }}
            >
              <Text style={editSubject ? styles.selectedText : styles.placeholderText}>
                {editSubject ? editSubject.title : "과목 선택"}
              </Text>
            </TouchableOpacity>

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

            <TouchableOpacity style={styles.button} onPress={handleUpdateNote}>
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
        visible={isEditSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>수정할 과목 선택</Text>

            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>등록된 과목이 없습니다.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.subjectItem}
                  onPress={() => {
                    setEditSubject(item);
                    setIsEditSubjectModalVisible(false);
                  }}
                >
                  <Text style={styles.subjectItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsEditSubjectModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>닫기</Text>
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
    color: "#e53e3e",
    marginBottom: 15,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#F2F2F2",
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
    backgroundColor: "#4A90E2",
  },

  tabButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#777",
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
    borderColor: "#ccc",
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
    color: "#999",
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    height: 160,
    textAlignVertical: "top",
  },

  button: {
    backgroundColor: "#4A90E2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },

  searchButton: {
    backgroundColor: "#4A90E2",
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

  card: {
    backgroundColor: "#F2F2F2",
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
    borderColor: "#4A90E2",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },

  editButtonText: {
    color: "#4A90E2",
    fontWeight: "bold",
  },

  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e53e3e",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },

  deleteButtonText: {
    color: "#e53e3e",
    fontWeight: "bold",
  },

  cancelButton: {
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  cancelButtonText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "bold",
  },

  emptyText: {
    color: "#777",
    marginTop: 10,
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
    backgroundColor: "#4A90E2",
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
    color: "#333",
  },

  deleteModalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  deleteCancelButton: {
    flex: 1,
    backgroundColor: "#F2F2F2",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteCancelButtonText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "bold",
  },

  deleteConfirmButton: {
    flex: 1,
    backgroundColor: "#e53e3e",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteConfirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});