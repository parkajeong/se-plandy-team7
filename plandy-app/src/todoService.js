import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from './firebase';

const TODO_COLLECTION_NAME = 'todos';
const SUBJECT_COLLECTION_NAME = 'subjects';

const TODO_CATEGORIES = ['시험', '과제', '복습', '기타'];

function getCurrentUserId() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  return user.uid;
}

function convertDateStringToTimestamp(dateString) {
  if (!dateString) {
    throw new Error('마감일을 선택해야 합니다.');
  }

  const date = new Date(`${dateString}T23:59:59`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('마감일 형식이 올바르지 않습니다.');
  }

  return Timestamp.fromDate(date);
}

function convertTimestampToDateString(timestamp) {
  if (!timestamp?.toDate) {
    return '';
  }

  const date = timestamp.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMillisFromTimestamp(timestamp) {
  if (!timestamp?.toDate) {
    return 0;
  }

  return timestamp.toDate().getTime();
}

function validateTodoInput(todoInput) {
  if (!todoInput.title?.trim()) {
    throw new Error('할 일 제목을 입력해야 합니다.');
  }

  if (!todoInput.subject_id?.trim()) {
    throw new Error('과목을 선택해야 합니다.');
  }

  if (!todoInput.category?.trim()) {
    throw new Error('할 일 유형을 선택해야 합니다.');
  }

  if (!TODO_CATEGORIES.includes(todoInput.category)) {
    throw new Error('할 일 유형은 시험, 과제, 복습, 기타 중 하나여야 합니다.');
  }

  if (!todoInput.deadline) {
    throw new Error('마감일을 선택해야 합니다.');
  }

  const priority = Number(todoInput.priority);

  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new Error('우선순위는 1부터 5까지의 숫자여야 합니다.');
  }
}

export async function fetchSubjects() {
  const userId = getCurrentUserId();
  const subjectsRef = collection(db, SUBJECT_COLLECTION_NAME);

  // subjectService.js가 userId 필드로 저장하므로 여기서도 userId 기준으로 조회
  const subjectsQuery = query(subjectsRef, where('userId', '==', userId));
  const snapshot = await getDocs(subjectsQuery);

  return snapshot.docs
    .map((subjectDocument) => {
      const data = subjectDocument.data();

      return {
        id: subjectDocument.id,
        user_id: data.user_id || data.userId || userId,
        userId: data.userId || data.user_id || userId,
        title: data.title || '',
        goal: data.goal || '',
        progress: Number(data.progress || 0),
        created_at:
          data.created_at?.toDate?.()?.toISOString?.() ||
          data.createdAt?.toDate?.()?.toISOString?.() ||
          '',
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

export async function createTodo(todoInput) {
  validateTodoInput(todoInput);

  const userId = getCurrentUserId();
  const todosRef = collection(db, TODO_COLLECTION_NAME);

  const docRef = await addDoc(todosRef, {
    // DB 명세서 기준 기본 필드
    user_id: userId,
    subject_id: todoInput.subject_id.trim(),
    title: todoInput.title.trim(),
    is_completed: false,
    deadline: convertDateStringToTimestamp(todoInput.deadline),
    priority: Number(todoInput.priority),
    created_at: serverTimestamp(),

    // 화면 요구사항 처리를 위한 추가 필드
    description: todoInput.description?.trim() || '',
    category: todoInput.category,
  });

  return docRef.id;
}

export async function fetchTodos() {
  const userId = getCurrentUserId();
  const todosRef = collection(db, TODO_COLLECTION_NAME);
  const todosQuery = query(todosRef, where('user_id', '==', userId));
  const snapshot = await getDocs(todosQuery);

  return snapshot.docs
    .map((todoDocument) => {
      const data = todoDocument.data();

      return {
        id: todoDocument.id,
        user_id: data.user_id || '',
        subject_id: data.subject_id || '',
        title: data.title || '',
        is_completed: Boolean(data.is_completed),
        deadline: convertTimestampToDateString(data.deadline),
        priority: Number(data.priority || 3),
        created_at: data.created_at?.toDate?.()?.toISOString?.() || '',

        description: data.description || '',
        category: data.category || '기타',

        deadline_millis: getMillisFromTimestamp(data.deadline),
        created_at_millis: getMillisFromTimestamp(data.created_at),
      };
    })
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }

      if (a.deadline_millis !== b.deadline_millis) {
        return a.deadline_millis - b.deadline_millis;
      }

      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return b.created_at_millis - a.created_at_millis;
    });
}

export async function updateTodo(todoId, todoInput) {
  validateTodoInput(todoInput);

  const todoRef = doc(db, TODO_COLLECTION_NAME, todoId);

  await updateDoc(todoRef, {
    subject_id: todoInput.subject_id.trim(),
    title: todoInput.title.trim(),
    deadline: convertDateStringToTimestamp(todoInput.deadline),
    priority: Number(todoInput.priority),

    description: todoInput.description?.trim() || '',
    category: todoInput.category,
  });
}

export async function completeTodo(todoId) {
  const todoRef = doc(db, TODO_COLLECTION_NAME, todoId);

  await updateDoc(todoRef, {
    is_completed: true,
  });
}

export async function reopenTodo(todoId) {
  const todoRef = doc(db, TODO_COLLECTION_NAME, todoId);

  await updateDoc(todoRef, {
    is_completed: false,
  });
}

export async function deleteTodo(todoId) {
  const todoRef = doc(db, TODO_COLLECTION_NAME, todoId);

  await deleteDoc(todoRef);
}