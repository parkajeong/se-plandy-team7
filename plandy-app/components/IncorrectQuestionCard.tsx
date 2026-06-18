import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/theme";

export type IncorrectQuestionItem = {
  id: string;
  result_id: string;
  quiz_id: string;
  quiz_title?: string;
  question_index: number;
  question: {
    question?: string;
    options?: string[];
    answer?: number;
    explanation?: string;
  };
  user_answer: number;
  is_review_needed: boolean;
  score: number;
  total_count: number;
  correct_rate: number;
  solved_at?: unknown;
};

type Props = {
  item: IncorrectQuestionItem;
  showQuizTitle?: boolean;
};

export default function IncorrectQuestionCard({
  item,
  showQuizTitle = false,
}: Props) {
  const options = Array.isArray(item.question.options)
    ? item.question.options
    : [];
  const answerIndex = Number(item.question.answer);
  const userAnswerIndex = Number(item.user_answer);

  return (
    <View style={styles.questionCard}>
      {showQuizTitle && (
        <Text style={styles.quizTitle}>{item.quiz_title || "AI 노트 퀴즈"}</Text>
      )}

      <View style={styles.questionHeader}>
        <Text style={styles.questionLabel}>문제 {item.question_index + 1}</Text>
        {item.is_review_needed && (
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>복습 필요</Text>
          </View>
        )}
      </View>

      <Text style={styles.questionText}>
        {item.question.question || "문제 내용 없음"}
      </Text>

      {options.map((option, optionIndex) => {
        const isAnswerOption = optionIndex === answerIndex;
        const isSelectedWrong =
          optionIndex === userAnswerIndex && optionIndex !== answerIndex;

        return (
          <View
            key={`${item.id}-${optionIndex}`}
            style={[
              styles.optionRow,
              isAnswerOption && styles.optionCorrect,
              isSelectedWrong && styles.optionIncorrect,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                isAnswerOption && styles.optionTextCorrect,
                isSelectedWrong && styles.optionTextIncorrect,
              ]}
            >
              {optionIndex + 1}. {option}
            </Text>
            {isAnswerOption && (
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            )}
            {isSelectedWrong && (
              <Ionicons name="close-circle" size={20} color="#EF4444" />
            )}
          </View>
        );
      })}

      <View style={styles.answerSection}>
        <Text style={styles.answerText}>
          내 답: {Number.isFinite(userAnswerIndex) ? `${userAnswerIndex + 1}번` : "-"}
        </Text>
        <Text style={styles.answerText}>
          정답: {Number.isFinite(answerIndex) ? `${answerIndex + 1}번` : "-"}
        </Text>
        <Text style={styles.explanationText}>
          해설: {item.question.explanation || "없음"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  questionCard: {
    backgroundColor: "#fff",
    borderColor: "#EF4444",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  quizTitle: {
    color: "#2B2B2B",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  questionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
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
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewBadgeText: {
    color: "#F97316",
    fontSize: 12,
  },
  questionText: {
    color: "#2B2B2B",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 12,
  },
  optionRow: {
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    padding: 10,
  },
  optionText: {
    color: "#2B2B2B",
    flex: 1,
    lineHeight: 20,
  },
  optionCorrect: {
    backgroundColor: "#F0FDF4",
    borderColor: "#22C55E",
  },
  optionIncorrect: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  optionTextCorrect: {
    color: "#15803D",
    fontWeight: "700",
  },
  optionTextIncorrect: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  answerSection: {
    borderTopColor: "#E5E7EB",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  answerText: {
    color: "#2B2B2B",
    lineHeight: 21,
  },
  explanationText: {
    color: "#6B7280",
    lineHeight: 21,
    marginTop: 6,
  },
});
