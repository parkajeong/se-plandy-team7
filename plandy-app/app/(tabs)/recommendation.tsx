import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { functions } from "@/src/firebase";

type Recommendation = {
  priority: number;
  subject: string;
  reason: string;
};

export default function RecommendationScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userId = getCurrentAppUserIdOrNull();

  const handleFetchRecommendation = async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const getStudyRecommendation = httpsCallable(functions, "getStudyRecommendation");
      const result = await getStudyRecommendation({ userId });
      const data = result.data as Recommendation[];

      if (!Array.isArray(data) || data.length === 0) {
        setRecommendations([]);
      } else {
        const sorted = [...data].sort((a, b) => a.priority - b.priority);
        setRecommendations(sorted);
      }
      setFetched(true);
    } catch (error: any) {
      setErrorMsg(error?.message || "추천을 불러오지 못했습니다. 다시 시도해주세요.");
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const renderEmpty = () => {
    if (!fetched) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="school-outline" size={48} color="#E5E7EB" />
        <Text style={styles.emptyText}>학습 데이터를 추가하면 추천을 받을 수 있어요</Text>
        <Text style={styles.emptySubText}>투두와 퀴즈를 먼저 등록해보세요.</Text>
      </View>
    );
  };

  const renderCard = ({ item, index }: { item: Recommendation; index: number }) => (
    <View style={styles.card}>
      <View style={styles.cardAccent} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{item.priority}</Text>
          </View>
          <Text style={styles.subjectTitle} numberOfLines={1}>
            {item.subject}
          </Text>
        </View>
        <Text style={styles.reasonText}>{item.reason}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="bulb-outline" size={28} color="#2B2B2B" />
        <Text style={styles.pageTitle}> 오늘의 학습 추천</Text>
      </View>

      <TouchableOpacity
        style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
        onPress={handleFetchRecommendation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.refreshButtonText}> 추천 받기</Text>
          </>
        )}
      </TouchableOpacity>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}> {errorMsg}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6a92" />
          <Text style={styles.loadingText}>AI가 학습 데이터를 분석하고 있어요...</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => String(item.priority)}
          renderItem={renderCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={recommendations.length === 0 ? styles.flatListEmpty : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F8F8FA",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2B2B2B",
  },
  refreshButton: {
    backgroundColor: "#ff6a92",
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#ff6a92",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fed7d7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  flatListEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 13,
    color: "#D1D5DB",
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#ff6a92",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardAccent: {
    width: 6,
    backgroundColor: "#ff6a92",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ff6a92",
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  subjectTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2B2B2B",
    flex: 1,
  },
  reasonText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
});
