import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { generateQuizFromNote } from "@/src/quizService";

const ALLOWED_QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];
const DEFAULT_QUESTION_COUNT = 5;
const GENERATE_ERROR_MESSAGE =
  "AI 퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const parseQuestionCount = (value: string | string[] | undefined) => {
  const parsed = Number.parseInt(getParam(value) || "", 10);
  return ALLOWED_QUESTION_COUNTS.includes(parsed)
    ? parsed
    : DEFAULT_QUESTION_COUNT;
};

export default function GenerateQuizScreen() {
  const params = useLocalSearchParams();
  const noteId = getParam(params.noteId);
  const subjectId = getParam(params.subjectId);
  const questionCount = parseQuestionCount(params.questionCount);
  const [errorMessage, setErrorMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      const userId = getCurrentAppUserIdOrNull();

      if (!userId) {
        setErrorMessage("로그인 후 퀴즈를 생성할 수 있습니다.");
        setIsGenerating(false);
        return;
      }

      if (!noteId || !subjectId) {
        setErrorMessage("노트 또는 과목 정보가 올바르지 않습니다.");
        setIsGenerating(false);
        return;
      }

      try {
        const result = (await generateQuizFromNote({
          noteId,
          userId,
          subjectId,
          questionCount,
        })) as { quizId?: string; id?: string };
        const quizId = result?.quizId || result?.id;

        if (!quizId) {
          throw new Error("생성된 퀴즈 ID를 받지 못했습니다.");
        }

        router.replace({
          pathname: "/quiz/[quizId]",
          params: { quizId },
        });
      } catch (error) {
        console.error("[quiz] generate failed", error);
        setErrorMessage(GENERATE_ERROR_MESSAGE);
      } finally {
        setIsGenerating(false);
      }
    };

    run();
  }, [noteId, questionCount, subjectId]);

  return (
    <View style={styles.container}>
      {isGenerating ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={styles.title}>AI 퀴즈를 생성하고 있습니다.</Text>
          <Text style={styles.description}>
            퀴즈 생성에 시간이 조금 걸릴 수 있습니다.
          </Text>
          <Text style={styles.countText}>문제 {questionCount}개</Text>
        </View>
      ) : (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={44} color="#e53e3e" />
          <Text style={styles.title}>퀴즈 생성 실패</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faff",
    padding: 24,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#1E3A5F",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 16,
    textAlign: "center",
  },
  description: {
    color: "#64748b",
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  countText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
  },
  errorText: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
