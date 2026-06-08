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
import { COLORS } from "@/constants/theme";
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
  getQuizResultsByUser,
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
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(5);
  const [noteLoadError, setNoteLoadError] = useState<string | null>(null);
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);

  const syncUserId = useCallback(() => {
    const currentUserId = getCurrentAppUserIdOrNull();

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
          setNotes([]);
          setNoteLoadError(noteError);
        }

        if (quizResult.status === "fulfilled") {
          setQuizzes(quizResult.value as Quiz[]);
        } else {
          const userMessage = getQuizErrorMessage(quizResult.reason);

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

  const loadQuizResults = useCallback(async () => {
    if (!userId) {
      setQuizResults([]);
      return;
    }

    try {
      const results = await getQuizResultsByUser(userId);
      const sortedResults = [...results].sort((a, b) => {
        const aTime = a.solved_at?.toDate?.()?.getTime?.() || 0;
        const bTime = b.solved_at?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });
      setQuizResults(sortedResults);
    } catch (error) {
      void error;
      setQuizResults([]);
    }
  }, [userId]);

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
    loadQuizResults();
  }, [loadSubjects, loadQuizResults]);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
      syncUserId();
      loadSubjects();
      loadSubjectData();
      loadQuizResults();
    }, [loadSubjectData, loadSubjects, loadQuizResults, syncUserId])
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
      Alert.alert("삭제 실패", error?.message || "퀴즈를 삭제하지 못했습니다.");
    }
  };

  const quizResultStats = React.useMemo(() => {
    if (!quizResults.length) {
      return null;
    }

    const rates = quizResults.map((item) => {
      if (typeof item.correct_rate === "number") return item.correct_rate;
      if (
        typeof item.score === "number" &&
        typeof item.total_count === "number" &&
        item.total_count > 0
      ) {
        return Math.round((item.score / item.total_count) * 100);
      }
      return 0;
    });

    const averageRate = Math.round(
      rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    );

    return {
      totalCount: quizResults.length,
      averageRate,
      recentRate: rates[0] ?? 0,
      recentResults: quizResults.slice(0, 3).map((item) => ({
        id: item.id,
        correct_rate:
          typeof item.correct_rate === "number"
            ? item.correct_rate
            : Math.round(
                (item.score / Math.max(1, item.total_count)) * 100
              ),
        solvedAt:
          item.solved_at?.toDate?.()?.toLocaleDateString?.("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }) || "-",
      })),
    };
  }, [quizResults]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>퀴즈</Text>
          <Text style={styles.screenSubtitle}>과목별로 생성된 퀴즈를 확인하세요</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addButton,
            (!userId || !selectedSubject || isNavigating) && styles.disabledButton,
          ]}
          onPress={handleOpenNoteModal}
          disabled={!userId || !selectedSubject || isNavigating}
        >
          {isNavigating ? (
            <ActivityIndicator color={COLORS.buttonText} size="small" />
          ) : (
            <Text style={styles.addButtonText}>+ 퀴즈 생성</Text>
          )}
        </TouchableOpacity>
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

      {userId && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>내 퀴즈 풀이 통계</Text>
          {quizResultStats ? (
            <>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>총 풀이 횟수</Text>
                <Text style={styles.statsValue}>{quizResultStats.totalCount}회</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>평균 정답률</Text>
                <Text style={styles.statsValue}>{quizResultStats.averageRate}%</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>최근 정답률</Text>
                <Text style={styles.statsValue}>{quizResultStats.recentRate}%</Text>
              </View>
              {quizResultStats.recentResults.length > 0 && (
                <View style={styles.recentList}>
                  {quizResultStats.recentResults.map((item) => (
                    <View key={item.id} style={styles.recentItem}>
                      <Text style={styles.recentText}>{item.solvedAt}</Text>
                      <Text style={styles.recentRateText}>{item.correct_rate}%</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>아직 풀이 기록이 없습니다.</Text>
          )}
        </View>
      )}

      {userId && subjects.length === 0 && (
        <Text style={styles.notice}>먼저 과목을 등록하세요.</Text>
      )}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#ff6a92" />
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
                  ? "아직 생성된 퀴즈가 없어요. 노트로 퀴즈를 만들어보세요!"
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
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
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
    backgroundColor: "#F8F8FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  screenSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.subText,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonText: {
    color: COLORS.buttonText,
    fontSize: 14,
    fontWeight: "600",
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statsLabel: {
    color: "#6B7280",
    fontSize: 13,
  },
  statsValue: {
    color: "#2B2B2B",
    fontSize: 13,
    fontWeight: "700",
  },
  recentList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recentText: {
    color: "#6B7280",
    fontSize: 13,
  },
  recentRateText: {
    color: "#ff6a92",
    fontSize: 13,
    fontWeight: "700",
  },
  notice: {
    color: "#9a3412",
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: "#9CA3AF",
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
    borderColor: "#E5E7EB",
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
    color: "#2B2B2B",
    fontSize: 17,
    fontWeight: "800",
  },
  metaText: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: "#6B7280",
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
    color: "#2B2B2B",
    marginBottom: 12,
  },
  optionLabel: {
    color: "#2B2B2B",
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
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  questionCountButtonSelected: {
    backgroundColor: "#ff6a92",
    borderColor: "#ff6a92",
  },
  questionCountText: {
    color: "#2B2B2B",
    fontWeight: "700",
  },
  questionCountTextSelected: {
    color: "#fff",
  },
  noteItem: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  noteItemDisabled: {
    backgroundColor: "#F8F8FA",
  },
  noteTitle: {
    color: "#2B2B2B",
    fontWeight: "700",
    marginBottom: 6,
  },
  notePreview: {
    color: "#6B7280",
    lineHeight: 20,
  },
  cancelButton: {
    backgroundColor: "#F8F8FA",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 6,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "700",
  },
});
