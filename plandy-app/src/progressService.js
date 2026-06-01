import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fetchCollectionByUser = async (collectionName, userId) => {
  const q = query(
    collection(db, collectionName),
    where("user_id", "==", userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
};

export const calculateSubjectProgress = (subjects = [], todos = [], notes = []) => {
  const todosBySubject = new Map();
  const notesBySubject = new Map();

  todos.forEach((todo) => {
    const subjectId = todo.subject_id;
    if (!subjectId) return;

    const current = todosBySubject.get(subjectId) || {
      todoCount: 0,
      completedTodoCount: 0,
    };

    current.todoCount += 1;
    if (todo.is_completed === true) {
      current.completedTodoCount += 1;
    }

    todosBySubject.set(subjectId, current);
  });

  notes.forEach((note) => {
    const subjectId = note.subject_id;
    if (!subjectId) return;
    notesBySubject.set(subjectId, (notesBySubject.get(subjectId) || 0) + 1);
  });

  return subjects.map((subject) => {
    const todoStats = todosBySubject.get(subject.id) || {
      todoCount: 0,
      completedTodoCount: 0,
    };
    const noteCount = notesBySubject.get(subject.id) || 0;
    const studyAmount = noteCount + todoStats.todoCount;
    const completionRate =
      todoStats.todoCount === 0
        ? 0
        : Math.round((todoStats.completedTodoCount / todoStats.todoCount) * 100);

    return {
      subjectId: subject.id,
      subjectTitle: subject.title || "제목 없음",
      noteCount,
      todoCount: todoStats.todoCount,
      completedTodoCount: todoStats.completedTodoCount,
      studyAmount,
      completionRate,
    };
  });
};

export const calculateOverallProgressTrend = (todos = []) => {
  const completedTodoDates = todos
    .filter((todo) => todo.is_completed === true)
    .map((todo) => {
      // TODO: 추후 completed_at 필드가 추가되면 해당 필드를 기준으로 변경
      const completedDate = toDate(todo.deadline) || toDate(todo.created_at);
      return completedDate ? formatDateKey(completedDate) : null;
    })
    .filter(Boolean)
    .sort();

  const completedCountsByDate = completedTodoDates.reduce((acc, dateKey) => {
    acc.set(dateKey, (acc.get(dateKey) || 0) + 1);
    return acc;
  }, new Map());

  let cumulativeCount = 0;
  return Array.from(completedCountsByDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => {
      cumulativeCount += count;
      return {
        date,
        count: cumulativeCount,
      };
    });
};

export const calculateOverallSummary = (subjects = [], todos = []) => {
  const totalTodoCount = todos.length;
  const completedTodoCount = todos.filter(
    (todo) => todo.is_completed === true
  ).length;

  return {
    totalSubjectCount: subjects.length,
    totalTodoCount,
    completedTodoCount,
    averageCompletionRate:
      totalTodoCount === 0
        ? 0
        : Math.round((completedTodoCount / totalTodoCount) * 100),
  };
};

export const fetchProgressData = async (userId) => {
  if (!userId) {
    throw new Error("userId is required");
  }

  const [subjects, todos, notes, quizResults] = await Promise.all([
    fetchCollectionByUser("subjects", userId),
    fetchCollectionByUser("todos", userId),
    fetchCollectionByUser("notes", userId),
    fetchCollectionByUser("quiz_results", userId),
  ]);

  return {
    subjects,
    todos,
    notes,
    quizResults,
    subjectProgress: calculateSubjectProgress(subjects, todos, notes),
    trend: calculateOverallProgressTrend(todos),
    summary: calculateOverallSummary(subjects, todos),
  };
};
