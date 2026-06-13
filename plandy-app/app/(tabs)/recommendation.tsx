import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/theme";
import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import { db, functions } from "@/src/firebase";
import { fetchProgressData } from "@/src/progressService";
import { getSubjects } from "@/src/subjectService";
import { getWeakQuizSubjects } from "@/src/utils/recommendationUtils";

type Recommendation = {
  priority: number;
  subject: string;
  reason: string;
};

type SubjectProgress = {
  subjectId: string;
  subjectTitle: string;
  noteCount: number;
  todoCount: number;
  completedTodoCount: number;
  studyAmount: number;
  completionRate: number;
};

type TrendPoint = {
  date: string;
  count: number;
};

type StudyAmountChartItem = {
  subjectId: string;
  subjectTitle: string;
  value: number;
};

type WeakSubject = {
  subjectId: string;
  subjectTitle: string;
  correctRate: number;
};

const WEAK_SUBJECT_THRESHOLD = 60;

const shortenLabel = (label: string, maxLength = 8) =>
  label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;

const getLineSegment = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = `${Math.atan2(deltaY, deltaX)}rad`;

  return {
    width: length,
    left: (from.x + to.x) / 2 - length / 2,
    top: (from.y + to.y) / 2 - 1.5,
    transform: [{ rotate: angle }],
  };
};

function BarChart({
  title,
  data,
}: {
  title: string;
  data: StudyAmountChartItem[];
}) {
  const { width } = useWindowDimensions();
  const chartWidth = width - 120;
  const chartHeight = 240;
  const leftPadding = 34;
  const rightPadding = 14;
  const topPadding = 22;
  const bottomPadding = 46;
  const plotWidth = chartWidth - leftPadding - rightPadding;
  const plotHeight = chartHeight - topPadding - bottomPadding;
  const visibleData = data.slice(0, 8);
  const maxValue = Math.max(...visibleData.map((item) => item.value), 1);
  const slotWidth = visibleData.length > 0 ? plotWidth / visibleData.length : plotWidth;
  const barWidth = Math.max(Math.min(slotWidth * 0.56, 44), 22);

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{title}</Text>
      {visibleData.length === 0 ? (
        <Text style={styles.chartEmptyText}>
          과목, 할 일, 노트를 추가하면 학습량 그래프를 확인할 수 있습니다.
        </Text>
      ) : (
        <View style={[styles.barChart, { width: chartWidth, height: chartHeight }]}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = topPadding + plotHeight - plotHeight * ratio;
            const label = Math.round(maxValue * ratio);
            return (
              <View key={ratio} style={[styles.gridLine, { top: y }]}>
                <Text style={styles.yAxisLabel}>{label}</Text>
                <View style={styles.gridRule} />
              </View>
            );
          })}

          <View
            style={[
              styles.yAxisLine,
              { left: leftPadding, top: topPadding, height: plotHeight },
            ]}
          />
          <View
            style={[
              styles.xAxisLine,
              {
                left: leftPadding,
                right: rightPadding,
                top: topPadding + plotHeight,
              },
            ]}
          />

          {visibleData.map((item, index) => {
            const barHeight =
              item.value === 0 ? 0 : Math.max((item.value / maxValue) * plotHeight, 8);
            const left = leftPadding + slotWidth * index + (slotWidth - barWidth) / 2;
            return (
              <View key={item.subjectId}>
                <Text
                  style={[
                    styles.barValue,
                    {
                      left: left - 8,
                      top: topPadding + plotHeight - barHeight - 20,
                      width: barWidth + 16,
                    },
                  ]}
                >
                  {item.value}
                </Text>
                <View
                  style={[
                    styles.barFill,
                    {
                      left,
                      top: topPadding + plotHeight - barHeight,
                      width: barWidth,
                      height: barHeight,
                    },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.barLabel,
                    {
                      left: left - 14,
                      top: topPadding + plotHeight + 10,
                      width: barWidth + 28,
                    },
                  ]}
                >
                  {shortenLabel(item.subjectTitle)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SubjectCompletionBars({
  title,
  data,
}: {
  title: string;
  data: SubjectProgress[];
}) {
  const hasTodos = data.some((item) => item.todoCount > 0);

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{title}</Text>
      {!hasTodos ? (
        <Text style={styles.chartEmptyText}>
          아직 등록된 할 일이 없어 완료율을 표시할 수 없습니다.
        </Text>
      ) : (
        <View style={styles.completionList}>
          {data.map((item) => {
            const completionRate = Math.min(
              Math.max(Math.round(item.completionRate), 0),
              100
            );
            return (
              <View key={item.subjectId} style={styles.completionRow}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.completionSubject}
                >
                  {item.subjectTitle}
                </Text>
                <View style={styles.completionBarOuter}>
                  <View
                    style={[
                      styles.completionBarInner,
                      { width: `${completionRate}%` as `${number}%` },
                    ]}
                  />
                </View>
                <Text style={styles.completionPercent}>{completionRate}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function LineChart({ title, data }: { title: string; data: TrendPoint[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = width - 120;
  const chartHeight = 230;
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const leftPadding = 34;
  const rightPadding = 16;
  const topPadding = 22;
  const bottomPadding = 44;
  const plotWidth = chartWidth - leftPadding - rightPadding;
  const plotHeight = chartHeight - topPadding - bottomPadding;

  const points = data.map((item, index) => {
    const x =
      leftPadding +
      (data.length === 1 ? plotWidth / 2 : (plotWidth / (data.length - 1)) * index);
    const y = topPadding + plotHeight - (item.count / maxValue) * plotHeight;
    return { ...item, x, y };
  });

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{title}</Text>
      {data.length <= 1 ? (
        <Text style={styles.chartEmptyText}>
          완료된 할 일이 생기면 학습 진척도 변화를 확인할 수 있습니다.
        </Text>
      ) : (
        <View style={[styles.lineChart, { width: chartWidth, height: chartHeight }]}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = topPadding + plotHeight - plotHeight * ratio;
            return (
              <View key={ratio} style={[styles.lineGridLine, { top: y }]}>
                <Text style={styles.yAxisLabel}>{Math.round(maxValue * ratio)}</Text>
                <View
                  style={[
                    styles.lineGridRule,
                    ratio === 0 && styles.lineBaseRule,
                  ]}
                />
              </View>
            );
          })}
          <View
            style={[
              styles.yAxisLine,
              { left: leftPadding, top: topPadding, height: plotHeight },
            ]}
          />
          {points.slice(1).map((point, index) => (
            <View
              key={`${point.date}-${index}`}
              style={[styles.lineSegment, getLineSegment(points[index], point)]}
            />
          ))}
          {points.map((point) => (
            <View
              key={point.date}
              style={[
                styles.linePoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                },
              ]}
            />
          ))}
          <Text style={[styles.lineDateLabel, { left: leftPadding }]}>
            {data[0]?.date.slice(5).replace("-", "/")}
          </Text>
          <Text style={[styles.lineDateLabel, { right: rightPadding }]}>
            {data[data.length - 1]?.date.slice(5).replace("-", "/")}
          </Text>
        </View>
      )}
    </View>
  );
}

function ProgressSection({
  isLoading,
  error,
  subjectProgress,
  studyAmountChartData,
  trend,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  subjectProgress: SubjectProgress[];
  studyAmountChartData: StudyAmountChartItem[];
  trend: TrendPoint[];
  onRetry: () => void;
}) {
  const hasSubjects = subjectProgress.length > 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeader}>
        <Ionicons name="analytics-outline" size={22} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>학습 진척도</Text>
      </View>

      {isLoading ? (
        <View style={styles.progressState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.stateText}>학습 데이터를 불러오는 중입니다.</Text>
        </View>
      ) : error ? (
        <View style={styles.progressState}>
          <Text style={styles.progressErrorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : !hasSubjects ? (
        <View style={styles.progressState}>
          <Text style={styles.emptyTitle}>아직 등록된 과목이 없습니다.</Text>
        </View>
      ) : (
        <>
          <BarChart title="과목별 학습량" data={studyAmountChartData} />
          <SubjectCompletionBars title="과목별 완료율" data={subjectProgress} />
          <LineChart title="전체 학습 진척도" data={trend} />
        </>
      )}
    </View>
  );
}

function WeakSubjectsSection({
  isLoading,
  error,
  weakSubjects,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  weakSubjects: WeakSubject[];
  onRetry: () => void;
}) {
  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeader}>
        <Ionicons name="alert-circle-outline" size={22} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>약점 과목</Text>
      </View>

      {isLoading ? (
        <View style={styles.progressState}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.stateText}>퀴즈 결과를 불러오는 중입니다.</Text>
        </View>
      ) : error ? (
        <View style={styles.progressState}>
          <Text style={styles.progressErrorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : weakSubjects.length === 0 ? (
        <View style={styles.progressState}>
          <Text style={styles.emptyTitle}>
            정답률이 낮은 과목이 없습니다. 퀴즈를 풀어 약점을 확인해보세요.
          </Text>
        </View>
      ) : (
        <View style={styles.completionList}>
          {weakSubjects.map((item) => (
            <View key={item.subjectId} style={styles.completionRow}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.completionSubject}
              >
                {item.subjectTitle}
              </Text>
              <View style={styles.completionBarOuter}>
                <View
                  style={[
                    styles.completionBarInner,
                    styles.weakBarInner,
                    { width: `${Math.min(Math.max(item.correctRate, 0), 100)}%` as `${number}%` },
                  ]}
                />
              </View>
              <Text style={styles.completionPercent}>{item.correctRate}%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function RecommendationScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);
  const [studyAmountChartData, setStudyAmountChartData] = useState<StudyAmountChartItem[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  const [isWeakSubjectsLoading, setIsWeakSubjectsLoading] = useState(false);
  const [weakSubjectsError, setWeakSubjectsError] = useState<string | null>(null);
  const [weakSubjects, setWeakSubjects] = useState<WeakSubject[]>([]);

  const userId = getCurrentAppUserIdOrNull();

  const loadProgress = useCallback(async () => {
    if (!userId) {
      setSubjectProgress([]);
      setStudyAmountChartData([]);
      setTrend([]);
      return;
    }

    try {
      setIsProgressLoading(true);
      setProgressError(null);
      const data = await fetchProgressData(userId);
      setSubjectProgress(data.subjectProgress as SubjectProgress[]);
      setStudyAmountChartData(data.studyAmountChartData as StudyAmountChartItem[]);
      setTrend(data.trend as TrendPoint[]);
    } catch (error) {
      void error;
      setProgressError("학습 진척도 데이터를 불러오지 못했습니다.");
    } finally {
      setIsProgressLoading(false);
    }
  }, [userId]);

  const loadWeakSubjects = useCallback(async () => {
    if (!userId) {
      setWeakSubjects([]);
      return;
    }

    try {
      setIsWeakSubjectsLoading(true);
      setWeakSubjectsError(null);

      const quizResultsQuery = query(
        collection(db, "quiz_results"),
        where("user_id", "==", userId)
      );
      const quizResultsSnapshot = await getDocs(quizResultsQuery);
      const quizResults = quizResultsSnapshot.docs.map((docSnapshot) => docSnapshot.data());

      const weakResults = getWeakQuizSubjects(quizResults, WEAK_SUBJECT_THRESHOLD);

      const subjects = await getSubjects(userId);
      const subjectTitleById = new Map(
        subjects.map((subject: any) => [subject.id, subject.title])
      );

      setWeakSubjects(
        weakResults.map((result: any) => ({
          subjectId: result.subject_id,
          subjectTitle: subjectTitleById.get(result.subject_id) || result.subject_id,
          correctRate: typeof result.correct_rate === "number" ? result.correct_rate : 0,
        }))
      );
    } catch (error) {
      void error;
      setWeakSubjectsError("약점 과목 데이터를 불러오지 못했습니다.");
    } finally {
      setIsWeakSubjectsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
      loadWeakSubjects();
    }, [loadProgress, loadWeakSubjects])
  );

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
    <LinearGradient
      colors={['#FFFFFF', '#EDF2F7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.titleRow}>
        <Ionicons name="bulb-outline" size={28} color={COLORS.primary} />
        <Text style={styles.screenTitle}>오늘의 학습 추천</Text>
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
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>AI가 학습 데이터를 분석하고 있어요...</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => String(item.priority)}
          renderItem={renderCard}
          ListHeaderComponent={
            <>
              <ProgressSection
                isLoading={isProgressLoading}
                error={progressError}
                subjectProgress={subjectProgress}
                studyAmountChartData={studyAmountChartData}
                trend={trend}
                onRetry={loadProgress}
              />
              <WeakSubjectsSection
                isLoading={isWeakSubjectsLoading}
                error={weakSubjectsError}
                weakSubjects={weakSubjects}
                onRetry={loadWeakSubjects}
              />
            </>
          }
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={recommendations.length === 0 ? styles.flatListEmpty : undefined}
        />
      )}
    </LinearGradient>
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
    gap: 10,
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 32,
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: COLORS.buttonText,
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
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardAccent: {
    width: 10,
    backgroundColor: COLORS.secondary,
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
    backgroundColor: COLORS.primary,
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
  progressSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#2B2B2B",
  },
  progressState: {
    alignItems: "center",
    paddingVertical: 22,
    gap: 8,
  },
  stateText: {
    color: "#6B7280",
    fontSize: 14,
  },
  progressErrorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  chartBlock: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 14,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  chartTitle: {
    color: "#2B2B2B",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  chartEmptyText: {
    color: "#D1D5DB",
    fontSize: 13,
    paddingVertical: 10,
  },
  barChart: {
    alignSelf: "center",
    backgroundColor: "#F8F8FA",
    borderColor: "#E5E7EB",
    borderRadius: 10,
    borderWidth: 1,
    position: "relative",
  },
  barValue: {
    position: "absolute",
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  barFill: {
    position: "absolute",
    backgroundColor: COLORS.secondary,
    borderRadius: 5,
  },
  barLabel: {
    position: "absolute",
    color: "#6B7280",
    fontSize: 11,
    textAlign: "center",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  yAxisLabel: {
    width: 28,
    color: "#D1D5DB",
    fontSize: 10,
    textAlign: "right",
    marginRight: 6,
  },
  gridRule: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  yAxisLine: {
    position: "absolute",
    width: 1.5,
    backgroundColor: "#D1D5DB",
  },
  xAxisLine: {
    position: "absolute",
    height: 1.5,
    backgroundColor: "#D1D5DB",
  },
  completionList: {
    gap: 12,
  },
  completionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  completionSubject: {
    width: 92,
    color: "#2B2B2B",
    fontSize: 13,
    fontWeight: "700",
  },
  completionBarOuter: {
    flex: 1,
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },
  completionBarInner: {
    height: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 999,
  },
  completionPercent: {
    width: 48,
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  weakBarInner: {
    backgroundColor: "#EF4444",
  },
  lineChart: {
    alignSelf: "center",
    backgroundColor: "#F8F8FA",
    borderColor: "#E5E7EB",
    borderRadius: 10,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  lineGridLine: {
    position: "absolute",
    left: 0,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  lineGridRule: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  lineBaseRule: {
    backgroundColor: "#D1D5DB",
    height: 1.5,
  },
  lineSegment: {
    position: "absolute",
    height: 3,
    backgroundColor: COLORS.secondary,
    borderRadius: 999,
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderColor: COLORS.secondary,
    borderWidth: 2,
  },
  lineDateLabel: {
    position: "absolute",
    bottom: 12,
    color: "#6B7280",
    fontSize: 11,
  },
});
