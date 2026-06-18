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

import { getIncorrectNotesByCurrentUser } from "@/src/quizService";
import { auth } from "@/src/firebase";
import { COLORS } from "@/constants/theme";
import IncorrectQuestionCard, {
  IncorrectQuestionItem,
} from "@/components/IncorrectQuestionCard";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const unstable_settings = {
  title: "오답노트",
};

export default function IncorrectNoteDetailScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const resultId = getParam(params.resultId);

  const [items, setItems] = useState<IncorrectQuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadGroup = useCallback(async () => {
    if (!auth.currentUser?.uid) {
      setErrorMessage("로그인 후 오답노트를 조회할 수 있습니다.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const notes = (await getIncorrectNotesByCurrentUser()) as IncorrectQuestionItem[];
      const matched = notes.filter((item) => item.result_id === resultId);

      if (!matched.length) {
        setErrorMessage("오답노트를 찾을 수 없습니다.");
        setItems([]);
        return;
      }

      setItems(matched);
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
    if (items[0]?.quiz_title) {
      navigation.setOptions({ title: items[0].quiz_title });
    }
  }, [navigation, items]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>오답노트를 불러오는 중...</Text>
      </View>
    );
  }

  if (errorMessage || !items.length) {
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
      <Text style={styles.title}>{items[0].quiz_title || "오답노트"}</Text>
      <Text style={styles.summary}>오답 {items.length}개</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <IncorrectQuestionCard item={item} />}
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
