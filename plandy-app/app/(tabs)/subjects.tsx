import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import {
  addSubject,
  deleteSubject,
  getSubjects,
  updateSubjectGoal,
} from "@/src/subjectService";
import { fetchProgressData } from "@/src/progressService";

type Subject = {
  id: string;
  title: string;
  goal: string;
  progress?: number;
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

type ProgressSummary = {
  totalSubjectCount: number;
  totalTodoCount: number;
  completedTodoCount: number;
  averageCompletionRate: number;
};

const emptySummary: ProgressSummary = {
  totalSubjectCount: 0,
  totalTodoCount: 0,
  completedTodoCount: 0,
  averageCompletionRate: 0,
};

const webConfirm = (message: string) => {
  if (Platform.OS === "web") {
    return window.confirm(message);
  }
  return true;
};

const showAlert = (message: string) => {
  if (Platform.OS === "web") {
    window.alert(message);
  }
};

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

function SummaryCard({ summary }: { summary: ProgressSummary }) {
  const items = [
    { label: "전체 과목 수", value: summary.totalSubjectCount },
    { label: "전체 할 일 수", value: summary.totalTodoCount },
    { label: "완료된 할 일 수", value: summary.completedTodoCount },
    { label: "전체 평균 완료율", value: `${summary.averageCompletionRate}%` },
  ];

  return (
    <View style={styles.summaryGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BarChart({
  title,
  data,
}: {
  title: string;
  data: StudyAmountChartItem[];
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 32, 280);
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
  const chartWidth = Math.max(width - 32, 280);
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
  summary,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  subjectProgress: SubjectProgress[];
  studyAmountChartData: StudyAmountChartItem[];
  trend: TrendPoint[];
  summary: ProgressSummary;
  onRetry: () => void;
}) {
  const hasSubjects = subjectProgress.length > 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeader}>
        <Ionicons name="analytics-outline" size={22} color="#ff6a92" />
        <Text style={styles.sectionTitle}>학습 진척도</Text>
      </View>

      {isLoading ? (
        <View style={styles.progressState}>
          <ActivityIndicator color="#ff6a92" />
          <Text style={styles.stateText}>학습 데이터를 불러오는 중입니다.</Text>
        </View>
      ) : error ? (
        <View style={styles.progressState}>
          <Text style={styles.errorText}>{error}</Text>
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
          <SummaryCard summary={summary} />
          <BarChart title="과목별 학습량" data={studyAmountChartData} />
          <SubjectCompletionBars title="과목별 완료율" data={subjectProgress} />
          <LineChart title="전체 학습 진척도" data={trend} />
        </>
      )}
    </View>
  );
}

function SubjectListHeader({
  title,
  goal,
  isProgressLoading,
  progressError,
  subjectProgress,
  studyAmountChartData,
  trend,
  summary,
  onTitleChange,
  onGoalChange,
  onAdd,
  onProgressRetry,
}: {
  title: string;
  goal: string;
  isProgressLoading: boolean;
  progressError: string | null;
  subjectProgress: SubjectProgress[];
  studyAmountChartData: StudyAmountChartItem[];
  trend: TrendPoint[];
  summary: ProgressSummary;
  onTitleChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onAdd: () => void;
  onProgressRetry: () => void;
}) {
  return (
    <>
      <View style={styles.titleRow}>
        <Ionicons name="book" size={28} color="#2B2B2B" />
        <Text style={styles.pageTitle}>과목 관리</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="과목명"
          placeholderTextColor="#D1D5DB"
          value={title}
          onChangeText={onTitleChange}
        />
        <TextInput
          style={styles.input}
          placeholder="학습 목표 (선택)"
          placeholderTextColor="#D1D5DB"
          value={goal}
          onChangeText={onGoalChange}
        />
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={styles.addButtonText}> 과목 추가</Text>
        </TouchableOpacity>
      </View>

      <ProgressSection
        isLoading={isProgressLoading}
        error={progressError}
        subjectProgress={subjectProgress}
        studyAmountChartData={studyAmountChartData}
        trend={trend}
        summary={summary}
        onRetry={onProgressRetry}
      />

      <Text style={styles.listTitle}>과목 목록</Text>
    </>
  );
}

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState("");
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);
  const [studyAmountChartData, setStudyAmountChartData] = useState<
    StudyAmountChartItem[]
  >([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [summary, setSummary] = useState<ProgressSummary>(emptySummary);

  const userId = getCurrentAppUserIdOrNull();

  const loadSubjects = useCallback(async () => {
    if (!userId) {
      setSubjects([]);
      return;
    }

    const data = await getSubjects(userId);
    setSubjects(data as Subject[]);
  }, [userId]);

  const loadProgress = useCallback(async () => {
    if (!userId) {
      setSubjectProgress([]);
      setStudyAmountChartData([]);
      setTrend([]);
      setSummary(emptySummary);
      return;
    }

    try {
      setIsProgressLoading(true);
      setProgressError(null);
      const data = await fetchProgressData(userId);
      setSubjectProgress(data.subjectProgress as SubjectProgress[]);
      setStudyAmountChartData(data.studyAmountChartData as StudyAmountChartItem[]);
      setTrend(data.trend as TrendPoint[]);
      setSummary(data.summary as ProgressSummary);
    } catch (error) {
      console.error("[subjects] Failed to load progress data:", error);
      setProgressError("학습 진척도 데이터를 불러오지 못했습니다.");
    } finally {
      setIsProgressLoading(false);
    }
  }, [userId]);

  const refreshScreen = useCallback(async () => {
    await Promise.all([loadSubjects(), loadProgress()]);
  }, [loadSubjects, loadProgress]);

  useEffect(() => {
    refreshScreen();
  }, [refreshScreen]);

  useFocusEffect(
    useCallback(() => {
      refreshScreen();
    }, [refreshScreen])
  );

  const progressBySubjectId = useMemo(() => {
    return new Map(subjectProgress.map((item) => [item.subjectId, item]));
  }, [subjectProgress]);

  const handleAdd = async () => {
    if (!title.trim()) {
      showAlert("과목명을 입력해주세요.");
      return;
    }
    if (!userId) return;

    await addSubject(userId, title.trim(), goal.trim());
    setTitle("");
    setGoal("");
    refreshScreen();
  };

  const handleUpdateGoal = async (id: string) => {
    await updateSubjectGoal(id, editGoal);
    setEditingId(null);
    refreshScreen();
  };

  const handleDelete = async (id: string) => {
    const confirmed = webConfirm("과목을 삭제하시겠습니까?");
    if (!confirmed) return;

    await deleteSubject(id);
    refreshScreen();
  };

  const listHeader = (
    <SubjectListHeader
      title={title}
      goal={goal}
      isProgressLoading={isProgressLoading}
      progressError={progressError}
      subjectProgress={subjectProgress}
      studyAmountChartData={studyAmountChartData}
      trend={trend}
      summary={summary}
      onTitleChange={setTitle}
      onGoalChange={setGoal}
      onAdd={handleAdd}
      onProgressRetry={loadProgress}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.subjectEmptyText}>등록된 과목이 없습니다.</Text>
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const stats = progressBySubjectId.get(item.id);
          const completionRate = stats?.completionRate ?? item.progress ?? 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <View style={styles.cardContent}>
                <Text style={styles.subjectTitle}>{item.title}</Text>

                {editingId === item.id ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.input, styles.editInput]}
                      value={editGoal}
                      onChangeText={setEditGoal}
                      placeholder="목표 수정"
                      placeholderTextColor="#D1D5DB"
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleUpdateGoal(item.id)}
                    >
                      <Text style={styles.saveButtonText}>저장</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingId(null)}
                    >
                      <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.goalRow}>
                    <Ionicons name="flag-outline" size={14} color="#6B7280" />
                    <Text style={styles.goalText}>
                      {" "}
                      {item.goal || "목표 없음"}
                    </Text>
                  </View>
                )}

                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>
                    완료율 {completionRate}%
                    {stats ? ` · 학습량 ${stats.studyAmount}` : ""}
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${completionRate}%` as `${number}%` },
                      ]}
                    />
                  </View>
                </View>

                {editingId !== item.id && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setEditingId(item.id);
                        setEditGoal(item.goal || "");
                      }}
                    >
                      <Ionicons name="pencil-outline" size={14} color="#F2C75C" />
                      <Text style={styles.editButtonText}> 수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={styles.deleteButtonText}> 삭제</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8FA",
  },
  listContent: {
    padding: 24,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2B2B2B",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#ff6a92",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
    color: "#2B2B2B",
    backgroundColor: "#F8F8FA",
  },
  addButton: {
    backgroundColor: "#ff6a92",
    padding: 13,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  progressSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#ff6a92",
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
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#ff6a92",
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
  emptyDescription: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  summaryItem: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#F8F8FA",
    borderColor: "#E5E7EB",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  summaryValue: {
    color: "#ff6a92",
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  chartBlock: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 14,
    marginTop: 12,
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
    color: "#ff6a92",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  barFill: {
    position: "absolute",
    backgroundColor: "#ff6a92",
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
    backgroundColor: "#ff6a92",
    borderRadius: 999,
  },
  completionPercent: {
    width: 48,
    color: "#ff6a92",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
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
    backgroundColor: "#ff6a92",
    borderRadius: 999,
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderColor: "#ff6a92",
    borderWidth: 2,
  },
  lineDateLabel: {
    position: "absolute",
    bottom: 12,
    color: "#6B7280",
    fontSize: 11,
  },
  listTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  subjectEmptyText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 18,
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
  subjectTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2B2B2B",
    marginBottom: 6,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  goalText: {
    fontSize: 14,
    color: "#6B7280",
  },
  progressRow: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    color: "#ff6a92",
    fontWeight: "600",
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#ff6a92",
    borderRadius: 999,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F2C75C",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    color: "#F2C75C",
    fontWeight: "600",
    fontSize: 13,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 13,
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  editInput: {
    flex: 1,
    marginBottom: 0,
  },
  saveButton: {
    backgroundColor: "#ff6a92",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  cancelButton: {
    backgroundColor: "#F8F8FA",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 13,
  },
});
