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

// 과목 등록 (FR-006)
export const addSubject = async (user_id, title, goal) => {
  const docRef = await addDoc(collection(db, "subjects"), {
    user_id,
    title,
    goal,
    progress: 0,
    created_at: serverTimestamp(),
  });
  return docRef.id;
};

// 과목 목록 조회
export const getSubjects = async (user_id) => {
  const q = query(collection(db, "subjects"), where("user_id", "==", user_id));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      dataId: data.id,
      documentId: doc.id,
      id: doc.id,
    };
  });
};

// 목표 수정 (FR-007, FR-008)
export const updateSubjectGoal = async (subjectId, goal) => {
  const ref = doc(db, "subjects", subjectId);
  await updateDoc(ref, { goal });
};

// 과목 삭제 (FR-008)
export const deleteSubject = async (subjectId) => {
  const ref = doc(db, "subjects", subjectId);
  await deleteDoc(ref);
};

// 진척도 업데이트 (FR-027)
export const updateProgress = async (subjectId, progress) => {
  const ref = doc(db, "subjects", subjectId);
  await updateDoc(ref, { progress });
};
