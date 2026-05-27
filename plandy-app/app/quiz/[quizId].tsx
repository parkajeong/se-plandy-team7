import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { fetchQuizById, getQuizErrorMessage } from "@/src/quizService";

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

export default function QuizDetailScreen() {
  const params = useLocalSearchParams();
  const quizId = getParam(params.quizId);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
      console.error("[quiz] detail load failed", error);
      setErrorMessage(getQuizErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>퀴즈를 불러오는 중...</Text>
      </View>
    );
  }

  if (errorMessage || !quiz) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={42} color="#e53e3e" />
        <Text style={styles.errorTitle}>퀴즈 조회 실패</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{quiz.title || "AI 노트 퀴즈"}</Text>
      <Text style={styles.summary}>문제 {questions.length}개</Text>

      <FlatList
        data={questions}
        keyExtractor={(_, index) => `${quiz.id}-${index}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={styles.questionCard}>
            <Text style={styles.questionLabel}>문제 {index + 1}</Text>
            <Text style={styles.questionText}>{item.question}</Text>

            {(item.options || []).map((option, optionIndex) => {
              const isAnswer = item.answer === optionIndex;

              return (
                <View
                  key={`${index}-${optionIndex}`}
                  style={[styles.optionRow, isAnswer && styles.answerOption]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isAnswer && styles.answerOptionText,
                    ]}
                  >
                    {optionIndex + 1}. {option}
                  </Text>
                </View>
              );
            })}

            <Text style={styles.answerText}>
              정답: {typeof item.answer === "number" ? item.answer + 1 : "-"}번
            </Text>
            <Text style={styles.explanationText}>
              해설: {item.explanation || "-"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faff",
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8faff",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 12,
  },
  title: {
    color: "#1E3A5F",
    fontSize: 26,
    fontWeight: "800",
  },
  summary: {
    color: "#64748b",
    marginBottom: 16,
    marginTop: 6,
  },
  listContent: {
    paddingBottom: 24,
  },
  questionCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  questionLabel: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  questionText: {
    color: "#1E3A5F",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 12,
  },
  optionRow: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    marginBottom: 8,
    padding: 10,
  },
  answerOption: {
    backgroundColor: "#dcfce7",
  },
  optionText: {
    color: "#334155",
    lineHeight: 20,
  },
  answerOptionText: {
    color: "#166534",
    fontWeight: "700",
  },
  answerText: {
    color: "#166534",
    fontWeight: "800",
    marginTop: 6,
  },
  explanationText: {
    color: "#64748b",
    lineHeight: 21,
    marginTop: 6,
  },
  errorTitle: {
    color: "#1E3A5F",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 14,
  },
  errorText: {
    color: "#64748b",
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#2563EB",
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
