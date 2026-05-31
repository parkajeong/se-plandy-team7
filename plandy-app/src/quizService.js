import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";

const DEBUG_QUIZ = process.env.EXPO_PUBLIC_DEBUG_QUIZ === "true";

const debugQuiz = (...args) => {
  if (DEBUG_QUIZ) {
    console.debug("[quiz]", ...args);
  }
};

const mapDoc = (snapshot) => ({
  ...snapshot.data(),
  id: snapshot.id,
});

const getDateMillis = (value) => {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  return date ? date.getTime() : 0;
};

const sortByCreatedAtDesc = (items) =>
  [...items].sort(
    (a, b) => getDateMillis(b.created_at) - getDateMillis(a.created_at)
  );

export const getQuizErrorMessage = (error) => {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code === "failed-precondition" && message.includes("requires an index")) {
    return "퀴즈 목록을 불러오기 위한 서버 인덱스 설정이 필요합니다. 잠시 후 다시 시도해 주세요.";
  }

  if (code === "permission-denied") {
    return "퀴즈를 조회할 권한이 없습니다.";
  }

  return message || "퀴즈를 불러오지 못했습니다.";
};

export const fetchQuizzesBySubject = async (userId, subjectId) => {
  debugQuiz("fetchQuizzesBySubject", { userId, subjectId });

  const q = query(
    collection(db, "quizzes"),
    where("user_id", "==", userId),
    where("subject_id", "==", subjectId)
  );

  const snapshot = await getDocs(q);
  const quizzes = sortByCreatedAtDesc(snapshot.docs.map(mapDoc));
  debugQuiz("fetchQuizzesBySubject result", { count: quizzes.length });

  return quizzes;
};

export const fetchQuizzes = async (userId) => {
  debugQuiz("fetchQuizzes", { userId });

  const q = query(
    collection(db, "quizzes"),
    where("user_id", "==", userId)
  );

  const snapshot = await getDocs(q);
  const quizzes = sortByCreatedAtDesc(snapshot.docs.map(mapDoc));
  debugQuiz("fetchQuizzes result", { count: quizzes.length });

  return quizzes;
};

export const fetchQuizById = async (quizId) => {
  debugQuiz("fetchQuizById", { quizId });

  const snapshot = await getDoc(doc(db, "quizzes", quizId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapDoc(snapshot);
};

export const fetchNotesBySubject = async (userId, subjectId) => {
  debugQuiz("fetchNotesBySubject", { userId, subjectId });

  const q = query(
    collection(db, "notes"),
    where("user_id", "==", userId),
    where("subject_id", "==", subjectId)
  );

  const snapshot = await getDocs(q);
  const notes = snapshot.docs.map(mapDoc);
  debugQuiz("fetchNotesBySubject result", {
    count: notes.length,
    noteIds: notes.map((note) => note.id),
    subjectIds: [...new Set(notes.map((note) => note.subject_id))],
  });

  return notes;
};

export const createQuiz = async ({ userId, subjectId, title, questions }) => {
  const docRef = doc(collection(db, "quizzes"));

  await setDoc(docRef, {
    id: docRef.id,
    user_id: userId,
    subject_id: subjectId,
    title,
    questions,
    created_at: serverTimestamp(),
  });

  return docRef.id;
};

export const deleteQuiz = async (quizId) => {
  await deleteDoc(doc(db, "quizzes", quizId));
};

export const generateQuizFromNote = async ({
  noteId,
  userId,
  subjectId,
  questionCount,
}) => {
  debugQuiz("generateQuizFromNote", {
    noteId,
    userId,
    subjectId,
    questionCount,
  });

  const callable = httpsCallable(functions, "generateQuizFromNote");
  const result = await callable({ noteId, userId, subjectId, questionCount });
  return result.data;
};
