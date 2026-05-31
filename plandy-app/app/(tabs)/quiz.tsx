import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import SubjectDropdown from "@/components/SubjectDropdown";
import {
  getCurrentAppUserIdOrNull,
  subscribeAppUserChange,
} from "@/src/appSession";
import { auth } from "@/src/firebase";
import {
  deleteQuiz,
  fetchNotesBySubject,
  fetchQuizzesBySubject,
  getQuizErrorMessage,
} from "@/src/quizService";
import { getSubjects } from "@/src/subjectService";

type Subject = {
  id: string;
  title: string;
};

type Note = {
  id: string;
  title?: string;
  content?: string;
};

type Quiz = {
  id: string;
  title?: string;
  questions?: unknown[];
  question_count?: number;
  created_at?: any;
};

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];
const DEBUG_QUIZ = process.env.EXPO_PUBLIC_DEBUG_QUIZ === "true";

const debugQuiz = (...args: unknown[]) => {
  if (DEBUG_QUIZ) {
    console.debug("[quiz]", ...args);
  }
};

const formatDate = (value: any) => {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);

  if (!date) return "-";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function QuizScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(5);
  const [noteLoadError, setNoteLoadError] = useState<string | null>(null);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);

  const syncUserId = useCallback(() => {
    const currentUserId = getCurrentAppUserIdOrNull();

    debugQuiz("syncUserId", {
      firebaseUid: auth.currentUser?.uid || null,
      resolvedUserId: currentUserId,
    });

    setUserId(currentUserId);
  }, []);

  const loadSubjects = useCallback(async () => {
    if (!userId) {
      setSubjects([]);
      return [];
    }

    const data = (await getSubjects(userId)) as Subject[];
    setSubjects(data);
    return data;
  }, [userId]);

  const loadSubjectData = useCallback(
    async (subject: Subject | null = selectedSubject) => {
      if (!userId || !subject?.id) {
        setNotes([]);
        setQuizzes([]);
        setNoteLoadError(null);
        setQuizLoadError(null);
        return { notesOk: false, noteError: null };
      }

      try {
        setIsLoading(true);
        setNoteLoadError(null);
        setQuizLoadError(null);

        const [noteResult, quizResult] = await Promise.allSettled([
          fetchNotesBySubject(userId, subject.id),
          fetchQuizzesBySubject(userId, subject.id),
        ]);

        let noteError: string | null = null;

        if (noteResult.status === "fulfilled") {
          setNotes(noteResult.value as Note[]);
        } else {
          noteError = noteResult.reason?.message || "노트 조회 중 오류가 발생했습니다.";
          console.error("[quiz] notes query failed", noteResult.reason);
          setNotes([]);
          setNoteLoadError(noteError);
        }

        if (quizResult.status === "fulfilled") {
          setQuizzes(quizResult.value as Quiz[]);
        } else {
          const userMessage = getQuizErrorMessage(quizResult.reason);

          if (DEBUG_QUIZ) {
            console.error("[quiz] quizzes query failed", quizResult.reason);
          }

          setQuizzes([]);
          setQuizLoadError(userMessage);
        }

        return {
          notesOk: noteResult.status === "fulfilled",
          noteError,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [selectedSubject, userId]
  );

  useEffect(() => {
    const unsubscribeFirebase = onAuthStateChanged(auth, syncUserId);
    const unsubscribeAppUser = subscribeAppUserChange(syncUserId);

    syncUserId();

    return () => {
      unsubscribeFirebase();
      unsubscribeAppUser();
    };
  }, [syncUserId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
      syncUserId();
      loadSubjects();
      loadSubjectData();
    }, [loadSubjectData, loadSubjects, syncUserId])
  );

  const handleSelectSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    await loadSubjectData(subject);
  };

  const handleOpenNoteModal = async () => {
    if (!userId) {
      Alert.alert("로그인 필요", "로그인 후 퀴즈를 생성할 수 있습니다.");
      return;
    }

    if (!selectedSubject?.id) {
      Alert.alert("과목 선택", "먼저 과목을 선택하세요.");
      return;
    }

    const result = await loadSubjectData(selectedSubject);

    if (!result.notesOk) {
      Alert.alert(
        "노트 조회 실패",
        result.noteError ||
          noteLoadError ||
          "노트를 조회하지 못했습니다. 권한 또는 네트워크 상태를 확인하세요."
      );
      return;
    }

    setIsNoteModalVisible(true);
  };

  const handleSelectNote = (note: Note) => {
    if (!selectedSubject?.id || !note.id) {
      Alert.alert("선택 오류", "노트 또는 과목 정보가 올바르지 않습니다.");
      return;
    }

    if (!note.content?.trim()) {
      Alert.alert("노트 내용 없음", "본문이 있는 노트만 퀴즈로 만들 수 있습니다.");
      return;
    }

    setIsNavigating(true);
    setIsNoteModalVisible(false);
    router.push({
      pathname: "/quiz/generate",
      params: {
        noteId: note.id,
        subjectId: selectedSubject.id,
        questionCount: String(selectedQuestionCount),
      },
    });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      await deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId));
      Alert.alert("삭제 완료", "퀴즈가 삭제되었습니다.");
    } catch (error: any) {
      console.error("[quiz] delete failed", error);
      Alert.alert("삭제 실패", error?.message || "퀴즈를 삭제하지 못했습니다.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="help-circle-outline" size={28} color="#1E3A5F" />
        <Text style={styles.pageTitle}> 퀴즈 관리</Text>
      </View>

      {!userId && (
        <Text style={styles.notice}>로그인 후 퀴즈를 생성하고 조회할 수 있습니다.</Text>
      )}

      <SubjectDropdown
        subjects={subjects}
        selectedSubjectId={selectedSubject?.id}
        placeholder="과목 선택"
        disabled={!userId || subjects.length === 0}
        onOpen={loadSubjects}
        onSelect={(subject) => handleSelectSubject(subject as Subject)}
      />

      {userId && subjects.length === 0 && (
        <Text style={styles.notice}>먼저 과목을 등록하세요.</Text>
      )}

      <TouchableOpacity
        style={[
          styles.generateButton,
          (!userId || !selectedSubject || isNavigating) && styles.disabledButton,
        ]}
        onPress={handleOpenNoteModal}
        disabled={!userId || !selectedSubject || isNavigating}
      >
        {isNavigating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="sparkles-outline" size={16} color="#fff" />
            <Text style={styles.generateButtonText}> AI 퀴즈 생성</Text>
          </>
        )}
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2563EB" />
      ) : (
        <FlatList
          data={quizzes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {quizLoadError
                ? quizLoadError
                : selectedSubject
                  ? "이 과목에 생성된 퀴즈가 없습니다."
                  : "과목을 선택하세요."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/quiz/[quizId]",
                  params: { quizId: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.quizTitle}>{item.title || "AI 노트 퀴즈"}</Text>
                <TouchableOpacity onPress={() => handleDeleteQuiz(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#e53e3e" />
                </TouchableOpacity>
              </View>
              <Text style={styles.metaText}>
                문제 {item.question_count || (Array.isArray(item.questions) ? item.questions.length : 0)}개
              </Text>
              <Text style={styles.metaText}>생성일 {formatDate(item.created_at)}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={isNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNoteModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>노트 선택</Text>

            <Text style={styles.optionLabel}>문제 수</Text>
            <View style={styles.questionCountRow}>
              {QUESTION_COUNT_OPTIONS.map((count) => {
                const isSelected = selectedQuestionCount === count;

                return (
                  <Pressable
                    key={count}
                    style={[
                      styles.questionCountButton,
                      isSelected && styles.questionCountButtonSelected,
                    ]}
                    onPress={() => setSelectedQuestionCount(count)}
                    disabled={isNavigating}
                  >
                    <Text
                      style={[
                        styles.questionCountText,
                        isSelected && styles.questionCountTextSelected,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <FlatList
              data={notes}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {noteLoadError || "이 과목에 노트가 없습니다."}
                </Text>
              }
              renderItem={({ item }) => {
                const isEmpty = !item.content?.trim();

                return (
                  <Pressable
                    style={[styles.noteItem, isEmpty && styles.noteItemDisabled]}
                    onPress={() => handleSelectNote(item)}
                    disabled={isNavigating}
                  >
                    <Text style={styles.noteTitle}>{item.title || "제목 없음"}</Text>
                    <Text style={styles.notePreview} numberOfLines={2}>
                      {isEmpty
                        ? "본문이 비어 있어 퀴즈를 생성할 수 없습니다."
                        : item.content}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsNoteModalVisible(false)}
              disabled={isNavigating}
            >
              <Text style={styles.cancelButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f8faff",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1E3A5F",
  },
  notice: {
    color: "#9a3412",
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    backgroundColor: "#9ca3af",
  },
  loader: {
    marginTop: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  quizTitle: {
    flex: 1,
    color: "#1E3A5F",
    fontSize: 17,
    fontWeight: "800",
  },
  metaText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: "#64748b",
    marginTop: 12,
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
    maxHeight: "75%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E3A5F",
    marginBottom: 12,
  },
  optionLabel: {
    color: "#1E3A5F",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  questionCountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  questionCountButton: {
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  questionCountButtonSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  questionCountText: {
    color: "#334155",
    fontWeight: "700",
  },
  questionCountTextSelected: {
    color: "#fff",
  },
  noteItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  noteItemDisabled: {
    backgroundColor: "#f1f5f9",
  },
  noteTitle: {
    color: "#1E3A5F",
    fontWeight: "700",
    marginBottom: 6,
  },
  notePreview: {
    color: "#64748b",
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 6,
  },
  cancelButtonText: {
    color: "#64748b",
    fontWeight: "700",
  },
});
