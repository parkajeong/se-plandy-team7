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

import { getCurrentAppUserId } from './appSession';
import { db } from './firebase';

const TODO_COLLECTION_NAME = 'todos';
const SUBJECT_COLLECTION_NAME = 'subjects';

const TODO_CATEGORIES = ['시험', '과제', '복습', '기타'];

function getCurrentUserId() {
  return getCurrentAppUserId();
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

function convertFirestoreDateToDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (value instanceof Date) {
    return value;
  }

  if (value?.toDate) {
    return value.toDate();
  }

  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return null;
}

function getTodoDeadlineValue(data) {
  return data.deadline || data.dueDate || data.due_date || data.deadline_at;
}

function convertFirestoreDateToDateString(value) {
  const date = convertFirestoreDateToDate(value);

  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMillisFromFirestoreDate(value) {
  const date = convertFirestoreDateToDate(value);

  if (!date) {
    return 0;
  }

  return date.getTime();
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

  const subjectsQuery = query(subjectsRef, where('user_id', '==', userId));
  const snapshot = await getDocs(subjectsQuery);

  return snapshot.docs
    .map((subjectDocument) => {
      const data = subjectDocument.data();

      return {
        id: subjectDocument.id,
        user_id: data.user_id || '',
        title: data.title || '',
        goal: data.goal || '',
        created_at: convertFirestoreDateToDateString(data.created_at),
      };
    })
    .filter((subject) => subject.title)
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

export async function createTodo(todoInput) {
  validateTodoInput(todoInput);

  const userId = getCurrentUserId();
  const todosRef = collection(db, TODO_COLLECTION_NAME);
  const deadlineTimestamp = convertDateStringToTimestamp(todoInput.deadline);

  const docRef = await addDoc(todosRef, {
    user_id: userId,
    subject_id: todoInput.subject_id.trim(),
    title: todoInput.title.trim(),
    is_completed: false,
    deadline: deadlineTimestamp,
    dueDate: deadlineTimestamp,
    priority: Number(todoInput.priority),
    created_at: serverTimestamp(),
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
      const deadlineValue = getTodoDeadlineValue(data);

      return {
        id: todoDocument.id,
        user_id: data.user_id || '',
        subject_id: data.subject_id || '',
        title: data.title || '',
        is_completed: Boolean(data.is_completed),
        deadline: convertFirestoreDateToDateString(deadlineValue),
        priority: Number(data.priority || 3),
        created_at: convertFirestoreDateToDateString(data.created_at),
        description: data.description || '',
        category: data.category || '기타',
        deadline_millis: getMillisFromFirestoreDate(deadlineValue),
        created_at_millis: getMillisFromFirestoreDate(data.created_at),
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
  const deadlineTimestamp = convertDateStringToTimestamp(todoInput.deadline);

  await updateDoc(todoRef, {
    subject_id: todoInput.subject_id.trim(),
    title: todoInput.title.trim(),
    deadline: deadlineTimestamp,
    dueDate: deadlineTimestamp,
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
  if (!todoId) {
    throw new Error('삭제할 할 일 ID가 없습니다.');
  }

  const todoRef = doc(db, TODO_COLLECTION_NAME, todoId);

  try {
    await deleteDoc(todoRef);
  } catch (error) {
    throw error;
  }
}

export async function fetchTodosBySubject(userId, subjectId) {
  const todosRef = collection(db, TODO_COLLECTION_NAME);
  const q = query(
    todosRef,
    where('user_id', '==', userId),
    where('subject_id', '==', subjectId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    is_completed: Boolean(d.data().is_completed),
  }));
}
