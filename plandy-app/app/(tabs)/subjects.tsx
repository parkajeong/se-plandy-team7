import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { COLORS } from "@/constants/theme";
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

function SubjectListHeader({
  subjectCount,
  summary,
}: {
  subjectCount: number;
  summary: ProgressSummary;
}) {
  return (
    <>
      <View style={styles.todoSummaryCard}>
        <View style={styles.todoSummaryItem}>
          <Text style={styles.todoSummaryLabel}>할일</Text>
          <Text style={styles.todoSummaryValue}>
            {summary.completedTodoCount} / {summary.totalTodoCount}
          </Text>
        </View>
        <View style={styles.todoSummaryDivider} />
        <View style={styles.todoSummaryItem}>
          <Text style={styles.todoSummaryLabel}>평균 완료율</Text>
          <Text style={styles.todoSummaryValue}>{summary.averageCompletionRate}%</Text>
        </View>
      </View>

      <Text style={styles.subjectCount}>과목 {subjectCount}개</Text>
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
  const [subjectProgress, setSubjectProgress] = useState<SubjectProgress[]>([]);
  const [summary, setSummary] = useState<ProgressSummary>(emptySummary);
  const [isAddSubjectModalVisible, setIsAddSubjectModalVisible] = useState(false);

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
      setSummary(emptySummary);
      return;
    }

    try {
      const data = await fetchProgressData(userId);
      setSubjectProgress(data.subjectProgress as SubjectProgress[]);
      setSummary(data.summary as ProgressSummary);
    } catch (error) {
      void error;
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

  const openAddSubjectModal = () => {
    if (!userId) {
      showAlert("로그인 후 과목을 추가할 수 있습니다.");
      return;
    }
    setTitle("");
    setGoal("");
    setIsAddSubjectModalVisible(true);
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      showAlert("과목명을 입력해주세요.");
      return;
    }
    if (!userId) return;

    await addSubject(userId, title.trim(), goal.trim());
    setTitle("");
    setGoal("");
    setIsAddSubjectModalVisible(false);
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
    <SubjectListHeader subjectCount={subjects.length} summary={summary} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>과목</Text>
          <Text style={styles.screenSubtitle}>등록한 과목과 노트를 확인하세요</Text>
        </View>
        <TouchableOpacity style={styles.addSubjectButton} onPress={openAddSubjectModal}>
          <Text style={styles.addSubjectButtonText}>+ 과목 추가</Text>
        </TouchableOpacity>
      </View>

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
          const noteCount = stats?.noteCount ?? 0;

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/subject-notes",
                  params: { subjectId: item.id, subjectTitle: item.title },
                })
              }
            >
              <View style={styles.cardAccent} />
              <View style={styles.cardContent}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.subjectTitle}>{item.title}</Text>
                  <Text style={styles.noteCountBadge}>📝 노트 {noteCount}개</Text>
                </View>

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
                      <Ionicons name="pencil-outline" size={14} color={COLORS.secondary} />
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
            </Pressable>
          );
        }}
      />

      <Modal
        visible={isAddSubjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddSubjectModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>과목 추가</Text>

            <TextInput
              style={styles.input}
              placeholder="과목명"
              placeholderTextColor="#D1D5DB"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="학습 목표 (선택)"
              placeholderTextColor="#D1D5DB"
              value={goal}
              onChangeText={setGoal}
            />

            <TouchableOpacity style={styles.modalSubmitButton} onPress={handleAdd}>
              <Text style={styles.modalSubmitButtonText}>추가하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setIsAddSubjectModalVisible(false)}
            >
              <Text style={styles.modalCancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: COLORS.subText,
    marginTop: 4,
  },
  addSubjectButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addSubjectButtonText: {
    color: "#1E293B",
    fontSize: 14,
    fontWeight: "700",
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
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: COLORS.background,
    borderRadius: 15,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 15,
  },
  modalSubmitButton: {
    backgroundColor: COLORS.secondary,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  modalSubmitButtonText: {
    color: "#1E293B",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancelButton: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: COLORS.subText,
    fontSize: 16,
    fontWeight: "700",
  },
  todoSummaryCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  todoSummaryItem: {
    flex: 1,
    alignItems: "center",
  },
  todoSummaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E5E7EB",
  },
  todoSummaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  todoSummaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  subjectCount: {
    fontSize: 12,
    color: COLORS.subText,
    marginBottom: 8,
    marginLeft: 4,
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
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2B2B2B",
  },
  noteCountBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.subText,
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
    color: COLORS.secondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: COLORS.secondary,
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
    borderColor: COLORS.secondary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editButtonText: {
    color: COLORS.secondary,
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
    backgroundColor: COLORS.primary,
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
