import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentAppUserIdOrNull } from "@/src/appSession";
import {
  addSubject,
  getSubjects,
  updateSubjectGoal,
  deleteSubject,
} from "@/src/subjectService";
import { fetchTodosBySubject } from "@/src/todoService";
import { fetchQuizResultsBySubject } from "@/src/quizService";

type Subject = {
  id: string;
  title: string;
  goal: string;
  progress: number;
};

const webConfirm = (message: string) => {
  if (Platform.OS === "web") {
    return window.confirm(message);
  }
  return true;
};

export default function SubjectsScreen() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState("");

  const userId = getCurrentAppUserIdOrNull();

  const calculateProgress = async (subjectId: string): Promise<number> => {
    if (!userId) return 0;
    const [todos, quizResults] = await Promise.all([
      fetchTodosBySubject(userId, subjectId),
      fetchQuizResultsBySubject(userId, subjectId),
    ]);

    const todoRate =
      todos.length > 0
        ? (todos.filter((t: any) => t.is_completed).length / todos.length) * 100
        : 0;

    let quizRate = 0;
    if (quizResults.length > 0) {
      const latestByQuiz = new Map<string, any>();
      quizResults.forEach((r: any) => {
        const existing = latestByQuiz.get(r.quiz_id);
        const rTime = r.solved_at?.toDate?.()?.getTime?.() ?? 0;
        const existingTime = existing?.solved_at?.toDate?.()?.getTime?.() ?? 0;
        if (!existing || rTime > existingTime) {
          latestByQuiz.set(r.quiz_id, r);
        }
      });
      const latestResults = Array.from(latestByQuiz.values());
      const sum = latestResults.reduce((acc: number, r: any) => {
        const rate =
          typeof r.correct_rate === "number"
            ? r.correct_rate
            : r.total_count > 0
            ? Math.round((r.score / r.total_count) * 100)
            : 0;
        return acc + rate;
      }, 0);
      quizRate = sum / latestResults.length;
    }

    return Math.round(todoRate * 0.6 + quizRate * 0.4);
  };

  const loadSubjects = async () => {
    if (!userId) return;
    const data = await getSubjects(userId);
    const subjectsWithProgress = await Promise.all(
      (data as Subject[]).map(async (subject) => ({
        ...subject,
        progress: await calculateProgress(subject.id),
      }))
    );
    setSubjects(subjectsWithProgress);
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const handleAdd = async () => {
    if (!title.trim()) {
      if (Platform.OS === "web") {
        window.alert("과목명을 입력해주세요");
      }
      return;
    }
    if (!userId) return;
    await addSubject(userId, title, goal);
    setTitle("");
    setGoal("");
    loadSubjects();
  };

  const handleUpdateGoal = async (id: string) => {
    await updateSubjectGoal(id, editGoal);
    setEditingId(null);
    loadSubjects();
  };

  const handleDelete = async (id: string) => {
    const confirmed = webConfirm("과목을 삭제하시겠습니까?");
    if (!confirmed) return;
    await deleteSubject(id);
    loadSubjects();
  };

  return (
    <View style={styles.container}>
      {/* 타이틀 */}
      <View style={styles.titleRow}>
        <Ionicons name="book" size={28} color="#1E3A5F" />
        <Text style={styles.pageTitle}> 과목 관리</Text>
      </View>

      {/* 등록 폼 */}
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

      {/* 과목 목록 */}
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardAccent} />
            <View style={styles.cardContent}>
              <Text style={styles.subjectTitle}>{item.title}</Text>

              {editingId === item.id ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
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
                    {" "}{item.goal || "목표 없음"}
                  </Text>
                </View>
              )}

              {/* 진척도 바 */}
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  진척도 {item.progress ?? 0}%
                </Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${item.progress ?? 0}%` as any },
                    ]}
                  />
                </View>
              </View>

              {/* 액션 버튼 */}
              {editingId !== item.id && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      setEditingId(item.id);
                      setEditGoal(item.goal);
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
        )}
      />
    </View>
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
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
