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

  const q = query(
    collection(db, "quizzes"),
    where("user_id", "==", userId),
    where("subject_id", "==", subjectId)
  );

  const snapshot = await getDocs(q);
  const quizzes = sortByCreatedAtDesc(snapshot.docs.map(mapDoc));

  return quizzes;
};

export const fetchQuizzes = async (userId) => {

  const q = query(
    collection(db, "quizzes"),
    where("user_id", "==", userId)
  );

  const snapshot = await getDocs(q);
  const quizzes = sortByCreatedAtDesc(snapshot.docs.map(mapDoc));

  return quizzes;
};

export const fetchQuizById = async (quizId) => {

  const snapshot = await getDoc(doc(db, "quizzes", quizId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapDoc(snapshot);
};

export const fetchNotesBySubject = async (userId, subjectId) => {

  const q = query(
    collection(db, "notes"),
    where("user_id", "==", userId),
    where("subject_id", "==", subjectId)
  );

  const snapshot = await getDocs(q);
  const notes = snapshot.docs.map(mapDoc);

  return notes;
};

export const submitQuizResult = async ({
  userId,
  quizId,
  score,
  total_count,
  correct_count,
  correct_rate,
  incorrect_items,
}) => {

  if (!userId || !quizId) {
    throw new Error("submitQuizResult: userId and quizId are required");
  }

  const makeQuizResultId = (uId, qId) => {
    const safe = (s) => String(s).replaceAll("/", "_");
    return `${safe(uId)}_${safe(qId)}`;
  };

  const resultId = makeQuizResultId(userId, quizId);

  const payload = {
    user_id: userId,
    quiz_id: quizId,
    score,
    total_count,
    correct_count,
    correct_rate,
    incorrect_items: Array.isArray(incorrect_items) ? incorrect_items : [],
    solved_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(doc(db, "quiz_results", resultId), payload);

  return resultId;
};

export const getQuizResultsByUser = async (userId) => {

  const q = query(
    collection(db, "quiz_results"),
    where("user_id", "==", userId)
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(mapDoc);
  return results;
};

export const fetchQuizResultsBySubject = async (userId, subjectId) => {
  const quizzes = await fetchQuizzesBySubject(userId, subjectId);
  if (!quizzes.length) return [];

  const quizIdSet = new Set(quizzes.map((q) => q.id));
  const allResults = await getQuizResultsByUser(userId);
  return allResults.filter((r) => quizIdSet.has(r.quiz_id));
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

  const callable = httpsCallable(functions, "generateQuizFromNote");
  const result = await callable({ noteId, userId, subjectId, questionCount });
  return result.data;
};

export const getIncorrectNoteGroupsByUser = async (userId) => {

  const quizResultsQuery = query(
    collection(db, "quiz_results"),
    where("user_id", "==", userId)
  );

  const quizResultsSnapshot = await getDocs(quizResultsQuery);
  const quizResultsData = quizResultsSnapshot.docs.map(mapDoc);

  // sort by updated_at (preferred) or solved_at desc
  const sortedResults = [...quizResultsData].sort((a, b) => {
    const aTime = getDateMillis(a.updated_at || a.solved_at);
    const bTime = getDateMillis(b.updated_at || b.solved_at);
    return bTime - aTime;
  });

  // dedupe by quiz_id keeping the latest result only
  const latestResultsByQuizId = new Map();
  sortedResults.forEach((r) => {
    if (!latestResultsByQuizId.has(r.quiz_id)) {
      latestResultsByQuizId.set(r.quiz_id, r);
    }
  });

  const dedupedQuizResults = Array.from(latestResultsByQuizId.values());

  const quizIds = [
    ...new Set(
      dedupedQuizResults.flatMap((result) =>
        Array.isArray(result.incorrect_items) && result.incorrect_items.length
          ? [result.quiz_id]
          : []
      )
    ),
  ].filter(Boolean);

  const quizMap = {};
  await Promise.all(
    quizIds.map(async (quizId) => {
      const quiz = await fetchQuizById(quizId);
      if (quiz) {
        quizMap[quizId] = quiz;
      }
    })
  );

  const groups = dedupedQuizResults
    .map((result) => {
      const incorrectItems = Array.isArray(result.incorrect_items)
        ? result.incorrect_items
        : [];

      if (!incorrectItems.length) return null;

      const quiz = quizMap[result.quiz_id];
      if (!quiz) return null;

      const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
      const solvedAtText = (result.updated_at || result.solved_at)?.toDate?.()?.toLocaleDateString?.("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }) || "-";

      const items = incorrectItems
        .map((incorrectItem) => {
          const questionIndex = Number(incorrectItem.question_index);
          const userAnswerIndex = Number(incorrectItem.user_answer);
          const question = questions[questionIndex] || null;

          if (!question) return null;

          const options = Array.isArray(question.options) ? question.options : [];
          const correctAnswerIndex = Number.isFinite(Number(question.answer))
            ? Number(question.answer)
            : -1;
          const correctAnswerText =
            options[correctAnswerIndex] ?? "정답 정보 없음";
          const userAnswerText =
            options[userAnswerIndex] ?? "선택 정보 없음";

          return {
            question_index: questionIndex,
            question: String(question.question || "문제 정보 없음"),
            user_answer_index: Number.isFinite(userAnswerIndex)
              ? userAnswerIndex
              : -1,
            user_answer_text: userAnswerText,
            correct_answer_index: Number.isFinite(correctAnswerIndex)
              ? correctAnswerIndex
              : -1,
            correct_answer_text: correctAnswerText,
            explanation: String(question.explanation || ""),
            is_review_needed: Boolean(incorrectItem.is_review_needed),
          };
        })
        .filter(Boolean);

      if (!items.length) return null;

      return {
        result_id: result.id,
        quiz_id: result.quiz_id,
        quiz_title: quiz.title || "AI 노트 퀴즈",
        solved_at: solvedAtText,
        incorrect_count: items.length,
        items,
      };
    })
    .filter(Boolean);

  const sortedGroups = groups.sort((a, b) => {
    const dateA = new Date(a.solved_at).getTime() || 0;
    const dateB = new Date(b.solved_at).getTime() || 0;
    return dateB - dateA;
  });


  return sortedGroups;
};
