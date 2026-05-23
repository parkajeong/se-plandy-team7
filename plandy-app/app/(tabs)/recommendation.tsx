import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/src/firebase";

type Recommendation = {
  priority: number;
  subject: string;
  reason: string;
  action: string;
};

type RecommendationResult = {
  recommendations: Recommendation[];
  summary: string;
};

export default function RecommendationScreen() {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetRecommendation = async () => {
    setLoading(true);
    try {
        const userId = getCurrentAppUserIdOrNull();
        if (!userId) return;

        const response = await fetch(
        "https://us-central1-se-plandy.cloudfunctions.net/getStudyRecommendation",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        }
        );
        const data = await response.json();
        setResult({
        recommendations: data.recommendations || [],
        summary: data.summary || "",
        });
    } catch (error) {
        console.error("추천 오류:", error);
        setResult({ recommendations: [], summary: "추천 데이터를 불러오지 못했습니다." });
    } finally {
        setLoading(false);
    }
    };

  return (
    <ScrollView style={styles.container}>
      {/* 타이틀 */}
      <View style={styles.titleRow}>
        <Ionicons name="bulb-outline" size={28} color="#1E3A5F" />
        <Text style={styles.pageTitle}> 학습 추천</Text>
      </View>

      {/* 추천 버튼 */}
      <TouchableOpacity
        style={styles.recommendButton}
        onPress={handleGetRecommendation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="sparkles-outline" size={18} color="#fff" />
            <Text style={styles.recommendButtonText}> AI 추천 받기</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 요약 */}
      {result?.summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>📊 {result.summary}</Text>
        </View>
      )}

      {/* 추천 목록 */}
      {result?.recommendations.map((item, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardAccent} />
          <View style={styles.cardContent}>
            <View style={styles.priorityRow}>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>우선순위 {item.priority}</Text>
              </View>
              <Text style={styles.subjectTitle}>{item.subject}</Text>
            </View>
            <Text style={styles.reasonText}>💡 {item.reason}</Text>
            <Text style={styles.actionText}>✅ {item.action}</Text>
          </View>
        </View>
      ))}

      {/* 빈 상태 */}
      {result && result.recommendations.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>추천할 항목이 없어요</Text>
        </View>
      )}
    </ScrollView>
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
  recommendButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  recommendButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  summaryCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    color: "#1E3A5F",
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#2563EB",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardAccent: {
    width: 6,
    backgroundColor: "#2563EB",
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  priorityBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  priorityText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 12,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E3A5F",
  },
  reasonText: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 6,
  },
  actionText: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 15,
  },
});