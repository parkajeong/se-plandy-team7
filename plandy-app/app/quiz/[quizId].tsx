import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import {
  fetchQuizById,
  getQuizErrorMessage,
  submitQuizResult,
} from "@/src/quizService";

type Question = {
  question?: string;
  options?: string[];
  answer?: number;
  explanation?: string;
};

type Quiz = {
  id: string;
  user_id?: string;
  title?: string;
  questions?: Question[];
};

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }

  Alert.alert(title, message, [{ text: "확인" }]);
};

export const unstable_settings = {
  title: "퀴즈",
};

export default function QuizDetailScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const quizId = getParam(params.quizId);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<{
    score: number;
    totalCount: number;
    correctRate: number;
    incorrectItems: { question_index: number; user_answer: number }[];
  }>({ score: 0, totalCount: 0, correctRate: 0, incorrectItems: [] });

  const loadQuiz = useCallback(async () => {
    const userId = getCurrentAppUserIdOrNull();

    if (!quizId) {
      setErrorMessage("퀴즈 정보가 올바르지 않습니다.");
      setIsLoading(false);
      return;
    }

    if (!userId) {
      setErrorMessage("로그인 후 퀴즈를 조회할 수 있습니다.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = (await fetchQuizById(quizId)) as Quiz | null;

      if (!data) {
        setErrorMessage("퀴즈를 찾을 수 없습니다.");
        return;
      }

      if (data.user_id !== userId) {
        setErrorMessage("이 퀴즈를 조회할 권한이 없습니다.");
        return;
      }

      setQuiz(data);
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(getQuizErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const handleSubmitAnswers = async () => {
    if (!quiz) return;

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

    const missingIndex = questions.findIndex(
      (_, index) => !Object.prototype.hasOwnProperty.call(selectedAnswers, index)
    );

    if (missingIndex !== -1) {
      showAlert("제출 불가", "모든 문제를 선택한 후 제출해 주세요.");
      return;
    }

    const incorrectItems: { question_index: number; user_answer: number }[] = [];
    let correctCount = 0;

    questions.forEach((item, index) => {
      const userAnswer = selectedAnswers[index];
      const answerIndex =
        typeof item.answer === "number" ? item.answer : Number(item.answer);
      const isCorrect = userAnswer === answerIndex;

      if (!isCorrect) {
        incorrectItems.push({
          question_index: index,
          user_answer: userAnswer,
        });
      } else {
        correctCount += 1;
      }
    });

    const totalCount = questions.length;
    const correctRate = totalCount
      ? Math.round((correctCount / totalCount) * 100)
      : 0;

    setIsSubmitting(true);

    try {
      const userId = getCurrentAppUserIdOrNull();

      if (!userId) {
        showAlert("로그인 필요", "로그인 후 퀴즈를 제출할 수 있습니다.");
        return;
      }

      await submitQuizResult({
        userId,
        quizId: quiz.id,
        score: correctCount,
        total_count: totalCount,
        correct_count: correctCount,
        correct_rate: correctRate,
        incorrect_items: incorrectItems.map((item) => ({
          ...item,
          is_review_needed: true,
        })),
      });

      setResultSummary({
        score: correctCount,
        totalCount,
        correctRate,
        incorrectItems,
      });
      setSubmitted(true);

      if (incorrectItems.length === 0) {
        showAlert("완벽해요!", "모든 문제를 맞혔습니다. 오답노트가 없습니다.");
      } else {
        showAlert(
          "저장 완료",
          `틀린 문제 ${incorrectItems.length}개가 오답노트에 저장되었습니다.`
        );
      }
    } catch (error) {
      void error;
      showAlert("저장 실패", "오답노트 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  useLayoutEffect(() => {
    if (quiz?.title) {
      navigation.setOptions({
        title: quiz.title,
      });
    }
  }, [navigation, quiz?.title]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#ff6a92" size="large" />
        <Text style={styles.loadingText}>퀴즈를 불러오는 중...</Text>
      </View>
    );
  }

  if (errorMessage || !quiz) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
        <Text style={styles.errorTitle}>퀴즈 조회 실패</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const allAnswered = questions.every((_, index) =>
    Object.prototype.hasOwnProperty.call(selectedAnswers, index)
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{quiz.title || "AI 노트 퀴즈"}</Text>
      <Text style={styles.summary}>문제 {questions.length}개</Text>

      {submitted && (
        <View style={styles.resultBanner}>
          <Text style={styles.resultBannerText}>
            {resultSummary.score}/{resultSummary.totalCount} 정답
          </Text>
          <Text style={styles.resultBannerSubText}>
            정답률 {resultSummary.correctRate}%
          </Text>
        </View>
      )}

      <FlatList
        data={questions}
        keyExtractor={(_, index) => `${quiz.id}-${index}`}
        style={styles.questionList}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const selectedIndex = selectedAnswers[index];
          const answerIndex =
            typeof item.answer === "number" ? item.answer : Number(item.answer);
          const isCorrect = submitted && selectedIndex === answerIndex;
          const isWrong = submitted && selectedIndex !== answerIndex;

          return (
            <View
              style={[
                styles.questionCard,
                submitted && isCorrect && styles.questionCardCorrect,
                submitted && isWrong && styles.questionCardIncorrect,
              ]}
            >
              <Text style={styles.questionLabel}>문제 {index + 1}</Text>
              <Text style={styles.questionText}>{item.question}</Text>

              {(item.options || []).map((option, optionIndex) => {
                const isSelected = selectedIndex === optionIndex;
                const isAnswerOption = answerIndex === optionIndex;

                let optionStateStyle = null;
                let optionTextStateStyle = null;
                let stateIcon = null;

                if (submitted) {
                  if (isSelected && isAnswerOption) {
                    optionStateStyle = styles.optionCorrect;
                    optionTextStateStyle = styles.optionTextCorrect;
                    stateIcon = (
                      <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                    );
                  } else if (isSelected && !isAnswerOption) {
                    optionStateStyle = styles.optionIncorrect;
                    optionTextStateStyle = styles.optionTextIncorrect;
                    stateIcon = (
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    );
                  } else if (isAnswerOption) {
                    optionStateStyle = styles.optionCorrect;
                    optionTextStateStyle = styles.optionTextCorrect;
                  }
                } else if (isSelected) {
                  optionStateStyle = styles.optionSelected;
                  optionTextStateStyle = styles.optionTextSelected;
                }

                return (
                  <TouchableOpacity
                    key={`${index}-${optionIndex}`}
                    activeOpacity={0.8}
                    disabled={submitted}
                    onPress={() => handleSelectAnswer(index, optionIndex)}
                    style={[styles.optionRow, optionStateStyle]}
                  >
                    <Text style={[styles.optionText, optionTextStateStyle]}>
                      {optionIndex + 1}. {option}
                    </Text>
                    {stateIcon}
                  </TouchableOpacity>
                );
              })}

              {submitted && (
                <View style={styles.answerSection}>
                  <Text style={styles.answerText}>
                    내 답: {selectedIndex !== undefined ? selectedIndex + 1 : "-"}번
                  </Text>
                  <Text style={styles.answerText}>
                    정답: {Number.isFinite(answerIndex) ? answerIndex + 1 : "-"}번
                  </Text>
                  <Text style={styles.explanationText}>
                    해설: {item.explanation || "없음"}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {!submitted ? (
        <TouchableOpacity
          style={[styles.submitButton, !allAnswered && styles.disabledButton]}
          onPress={handleSubmitAnswers}
          disabled={!allAnswered || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? "제출 중..." : "제출하기"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>오답 노트</Text>
          {resultSummary.incorrectItems.length === 0 ? (
            <Text style={styles.emptyText}>모든 문제를 맞혔습니다!</Text>
          ) : (
            resultSummary.incorrectItems.map((item) => (
              <Text key={item.question_index} style={styles.reviewItemText}>
                {item.question_index + 1}번 문제 - 내 답 {item.user_answer + 1}번
              </Text>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FA",
    padding: 24,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#6B7280",
    marginTop: 12,
  },
  title: {
    color: "#2B2B2B",
    fontSize: 26,
    fontWeight: "800",
  },
  summary: {
    color: "#6B7280",
    marginBottom: 16,
    marginTop: 6,
  },
  questionList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  questionLabel: {
    color: "#ff6a92",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  questionText: {
    color: "#2B2B2B",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F8FA",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10,
  },
  answerOption: {
    backgroundColor: "#dcfce7",
  },
  optionText: {
    color: "#2B2B2B",
    flex: 1,
    lineHeight: 20,
  },
  answerOptionText: {
    color: "#22C55E",
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#ff6a92",
    fontWeight: "700",
  },
  optionTextCorrect: {
    color: "#15803D",
    fontWeight: "700",
  },
  optionTextIncorrect: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  optionSelected: {
    backgroundColor: "#FFF0F4",
    borderColor: "#ff6a92",
  },
  optionCorrect: {
    backgroundColor: "#F0FDF4",
    borderColor: "#22C55E",
  },
  optionIncorrect: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  questionCardCorrect: {
    borderColor: "#22C55E",
  },
  questionCardIncorrect: {
    borderColor: "#fca5a5",
  },
  answerText: {
    color: "#22C55E",
    fontWeight: "800",
    marginTop: 6,
  },
  answerSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  explanationText: {
    color: "#6B7280",
    lineHeight: 21,
    marginTop: 6,
  },
  resultBanner: {
    backgroundColor: "#F8F8FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff6a92",
    marginBottom: 16,
    padding: 14,
  },
  resultBannerText: {
    color: "#ff6a92",
    fontSize: 16,
    fontWeight: "800",
  },
  resultBannerSubText: {
    color: "#ff6a92",
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#ff6a92",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 14,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  reviewSection: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginTop: 12,
  },
  reviewTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  reviewItemText: {
    color: "#2B2B2B",
    lineHeight: 22,
    marginBottom: 4,
  },
  emptyText: {
    color: "#6B7280",
    lineHeight: 22,
  },
  disabledButton: {
    backgroundColor: "#D1D5DB",
  },
  errorTitle: {
    color: "#2B2B2B",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 14,
  },
  errorText: {
    color: "#6B7280",
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#ff6a92",
    borderRadius: 10,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
