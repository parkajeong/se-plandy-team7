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
  valueKey,
  suffix = "",
}: {
  title: string;
  data: SubjectProgress[];
  valueKey: "studyAmount" | "completionRate";
  suffix?: string;
}) {
  const chartData = data.filter((item) =>
    valueKey === "completionRate" ? item.todoCount > 0 : item.studyAmount > 0
  );
  const maxValue = Math.max(...chartData.map((item) => item[valueKey]), 1);
  const visibleData = chartData.slice(0, 8);

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{title}</Text>
      {visibleData.length === 0 ? (
        <Text style={styles.chartEmptyText}>표시할 데이터가 없습니다.</Text>
      ) : (
        <View style={styles.barChart}>
          {visibleData.map((item) => {
            const value = item[valueKey];
            const heightPercent =
              value === 0 ? 0 : Math.max((value / maxValue) * 100, 6);

            return (
              <View key={item.subjectId} style={styles.barItem}>
                <Text style={styles.barValue}>
                  {value}
                  {suffix}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                </View>
                <Text numberOfLines={1} style={styles.barLabel}>
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

function LineChart({ title, data }: { title: string; data: TrendPoint[] }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(Math.min(width - 96, 640), 220);
  const chartHeight = 160;
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const leftPadding = 18;
  const rightPadding = 12;
  const topPadding = 16;
  const bottomPadding = 28;
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
      {data.length === 0 ? (
        <Text style={styles.chartEmptyText}>표시할 데이터가 없습니다.</Text>
      ) : (
        <View style={[styles.lineChart, { width: chartWidth, height: chartHeight }]}>
          <Text style={styles.yAxisMax}>{maxValue}</Text>
          <View style={styles.lineAxis} />
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
          <Text style={styles.lineStartLabel}>
            {data[0]?.date.slice(5).replace("-", "/")}
          </Text>
          <Text style={styles.lineEndLabel}>
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
  trend,
  summary,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  subjectProgress: SubjectProgress[];
  trend: TrendPoint[];
  summary: ProgressSummary;
  onRetry: () => void;
}) {
  const hasProgressData =
    subjectProgress.some(
      (item) => item.studyAmount > 0 || item.completedTodoCount > 0
    ) || trend.length > 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.sectionHeader}>
        <Ionicons name="analytics-outline" size={22} color="#2563EB" />
        <Text style={styles.sectionTitle}>학습 진척도</Text>
      </View>

      {isLoading ? (
        <View style={styles.progressState}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.stateText}>학습 데이터를 불러오는 중입니다.</Text>
        </View>
      ) : error ? (
        <View style={styles.progressState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : !hasProgressData ? (
        <View style={styles.progressState}>
          <Text style={styles.emptyTitle}>아직 표시할 학습 데이터가 없습니다.</Text>
          <Text style={styles.emptyDescription}>
            과목, 할 일, 노트를 추가하면 학습 진척도를 확인할 수 있습니다.
          </Text>
        </View>
      ) : (
        <>
          <SummaryCard summary={summary} />
          <BarChart title="과목별 학습량" data={subjectProgress} valueKey="studyAmount" />
          <BarChart
            title="과목별 완료율"
            data={subjectProgress}
            valueKey="completionRate"
            suffix="%"
          />
          <LineChart title="전체 학습 진척도" data={trend} />
        </>
      )}
    </View>
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
      setTrend([]);
      setSummary(emptySummary);
      return;
    }

    try {
      setIsProgressLoading(true);
      setProgressError(null);
      const data = await fetchProgressData(userId);
      setSubjectProgress(data.subjectProgress as SubjectProgress[]);
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

  const renderHeader = () => (
    <>
      <View style={styles.titleRow}>
        <Ionicons name="book" size={28} color="#1E3A5F" />
        <Text style={styles.pageTitle}>과목 관리</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="과목명"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="학습 목표 (선택)"
          placeholderTextColor="#94a3b8"
          value={goal}
          onChangeText={setGoal}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Text style={styles.addButtonText}> 과목 추가</Text>
        </TouchableOpacity>
      </View>

      <ProgressSection
        isLoading={isProgressLoading}
        error={progressError}
        subjectProgress={subjectProgress}
        trend={trend}
        summary={summary}
        onRetry={loadProgress}
      />

      <Text style={styles.listTitle}>과목 목록</Text>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
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
                      placeholderTextColor="#94a3b8"
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
                    <Ionicons name="flag-outline" size={14} color="#64748b" />
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
                      <Ionicons name="pencil-outline" size={14} color="#2563EB" />
                      <Text style={styles.editButtonText}> 수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#e53e3e" />
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
    backgroundColor: "#f8faff",
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
    color: "#1E3A5F",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowColor: "#2563EB",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
    color: "#1E3A5F",
    backgroundColor: "#f8faff",
  },
  addButton: {
    backgroundColor: "#2563EB",
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
    shadowColor: "#2563EB",
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
    color: "#1E3A5F",
  },
  progressState: {
    alignItems: "center",
    paddingVertical: 22,
    gap: 8,
  },
  stateText: {
    color: "#64748b",
    fontSize: 14,
  },
  errorText: {
    color: "#e53e3e",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyTitle: {
    color: "#1E3A5F",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    color: "#64748b",
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
    backgroundColor: "#f8faff",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  summaryValue: {
    color: "#2563EB",
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  chartBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    marginTop: 12,
  },
  chartTitle: {
    color: "#1E3A5F",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  chartEmptyText: {
    color: "#94a3b8",
    fontSize: 13,
    paddingVertical: 10,
  },
  barChart: {
    height: 180,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
  },
  barItem: {
    flex: 1,
    minWidth: 34,
    alignItems: "center",
  },
  barValue: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  barTrack: {
    width: "78%",
    height: 118,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barLabel: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 6,
    maxWidth: 72,
  },
  lineChart: {
    alignSelf: "center",
    backgroundColor: "#f8faff",
    borderColor: "#e2e8f0",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  yAxisMax: {
    position: "absolute",
    left: 4,
    top: 8,
    color: "#94a3b8",
    fontSize: 10,
  },
  lineAxis: {
    position: "absolute",
    left: 18,
    right: 12,
    bottom: 28,
    height: 1,
    backgroundColor: "#cbd5e1",
  },
  lineSegment: {
    position: "absolute",
    height: 3,
    backgroundColor: "#2563EB",
    borderRadius: 999,
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderColor: "#2563EB",
    borderWidth: 2,
  },
  lineStartLabel: {
    position: "absolute",
    left: 18,
    bottom: 8,
    color: "#64748b",
    fontSize: 11,
  },
  lineEndLabel: {
    position: "absolute",
    right: 12,
    bottom: 8,
    color: "#64748b",
    fontSize: 11,
  },
  listTitle: {
    color: "#1E3A5F",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  subjectEmptyText: {
    color: "#64748b",
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
    shadowColor: "#2563EB",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  cardAccent: {
    width: 6,
    backgroundColor: "#2563EB",
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
    color: "#1E3A5F",
    marginBottom: 6,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  goalText: {
    fontSize: 14,
    color: "#64748b",
  },
  progressRow: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#2563EB",
    borderRadius: 999,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e53e3e",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: "#e53e3e",
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
    backgroundColor: "#2563EB",
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
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 13,
  },
});
