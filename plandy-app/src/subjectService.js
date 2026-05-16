import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// 과목 등록 (FR-004)
export const addSubject = async (userId, title, goal) => {
  const docRef = await addDoc(collection(db, "subjects"), {
    userId,
    title,
    goal,
    progress: 0,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// 과목 목록 조회
export const getSubjects = async (userId) => {
  const q = query(collection(db, "subjects"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// 목표 수정 (FR-005, FR-006)
export const updateSubjectGoal = async (subjectId, goal) => {
  const ref = doc(db, "subjects", subjectId);
  await updateDoc(ref, { goal });
};

// 과목 삭제 (FR-006)
export const deleteSubject = async (subjectId) => {
  const ref = doc(db, "subjects", subjectId);
  await deleteDoc(ref);
};

// 진척도 업데이트 (FR-027)
export const updateProgress = async (subjectId, progress) => {
  const ref = doc(db, "subjects", subjectId);
  await updateDoc(ref, { progress });
};