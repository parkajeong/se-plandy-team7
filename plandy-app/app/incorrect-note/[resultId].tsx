import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { getIncorrectNoteGroupsByUser } from "@/src/quizService";
import { COLORS } from "@/constants/theme";

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

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

const getCircledNumber = (index: number) =>
  index >= 0 && index < CIRCLED_NUMBERS.length
    ? CIRCLED_NUMBERS[index]
    : `${index + 1}.`;

export const unstable_settings = {
  title: "오답노트",
};

export default function IncorrectNoteDetailScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const resultId = getParam(params.resultId);

  const [group, setGroup] = useState<IncorrectNoteGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadGroup = useCallback(async () => {
    const userId = getCurrentAppUserIdOrNull();

    if (!userId) {
      setErrorMessage("로그인 후 오답노트를 조회할 수 있습니다.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const groups = (await getIncorrectNoteGroupsByUser(
        userId
      )) as IncorrectNoteGroup[];
      const matched = groups.find(
        (item) => item.result_id === resultId || item.quiz_id === resultId
      );

      if (!matched) {
        setErrorMessage("오답노트를 찾을 수 없습니다.");
        setGroup(null);
        return;
      }

      setGroup(matched);
      setErrorMessage("");
    } catch (error) {
      void error;
      setErrorMessage("오답노트 조회에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useLayoutEffect(() => {
    if (group?.quiz_title) {
      navigation.setOptions({ title: group.quiz_title });
    }
  }, [navigation, group?.quiz_title]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>오답노트를 불러오는 중...</Text>
      </View>
    );
  }

  if (errorMessage || !group) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
        <Text style={styles.errorTitle}>오답노트 조회 실패</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{group.quiz_title}</Text>
      <Text style={styles.summary}>
        오답 {group.incorrect_count}개 · {group.solved_at}
      </Text>

      <FlatList
        data={group.items}
        keyExtractor={(item, index) =>
          `${group.quiz_id}-${item.question_index}-${index}`
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionLabel}>
                Q{item.question_index + 1}.
              </Text>
              {item.is_review_needed && (
                <View style={styles.reviewBadge}>
                  <Text style={styles.reviewBadgeText}>복습 필요</Text>
                </View>
              )}
            </View>

            <Text style={styles.questionText}>{item.question}</Text>

            <View style={styles.answerSection}>
              <Text style={styles.answerRow}>
                <Text style={styles.answerLabel}>내 답: </Text>
                <Text style={styles.wrongAnswerText}>
                  {getCircledNumber(item.user_answer_index)} {item.user_answer_text}
                </Text>
              </Text>
              <Text style={styles.answerRow}>
                <Text style={styles.answerLabel}>정답: </Text>
                <Text style={styles.correctAnswerText}>
                  {getCircledNumber(item.correct_answer_index)}{" "}
                  {item.correct_answer_text}
                </Text>
              </Text>
            </View>

            {item.explanation ? (
              <View style={styles.explanationSection}>
                <Text style={styles.explanationText}>
                  해설: {item.explanation}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      />
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

  errorTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },

  errorText: {
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },

  backButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  title: {
    color: "#2B2B2B",
    fontSize: 22,
    fontWeight: "800",
  },

  summary: {
    color: "#6B7280",
    marginBottom: 16,
    marginTop: 6,
  },

  listContent: {
    paddingBottom: 24,
  },

  questionCard: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },

  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  questionLabel: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  reviewBadge: {
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  reviewBadgeText: {
    fontSize: 12,
    color: "#F97316",
  },

  questionText: {
    color: "#2B2B2B",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 12,
  },

  answerSection: {
    gap: 6,
  },

  answerRow: {
    fontSize: 14,
    lineHeight: 21,
  },

  answerLabel: {
    color: "#2B2B2B",
    fontWeight: "700",
  },

  correctAnswerText: {
    color: "#22C55E",
    fontWeight: "700",
  },

  wrongAnswerText: {
    color: "#EF4444",
    fontWeight: "700",
  },

  explanationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  explanationText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
  },
});
