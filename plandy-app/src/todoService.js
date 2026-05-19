import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase';

function getCurrentUserId() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  return user.uid;
}

function getTodoCollectionRef() {
  const userId = getCurrentUserId();
  return collection(db, 'users', userId, 'todos');
}

export async function createTodo(todoInput) {
  const todosRef = getTodoCollectionRef();

  await addDoc(todosRef, {
    title: todoInput.title,
    description: todoInput.description || '',
    courseName: todoInput.courseName || '',
    type: todoInput.type || 'assignment',
    dueDate: todoInput.dueDate || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function fetchTodos() {
  const todosRef = getTodoCollectionRef();
  const todosQuery = query(todosRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(todosQuery);

  return snapshot.docs.map((todoDocument) => {
    const data = todoDocument.data();

    return {
      id: todoDocument.id,
      title: data.title || '',
      description: data.description || '',
      courseName: data.courseName || '',
      type: data.type || 'etc',
      dueDate: data.dueDate || '',
      status: data.status || 'pending',
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || '',
    };
  });
}

export async function updateTodo(todoId, todoInput) {
  const userId = getCurrentUserId();
  const todoRef = doc(db, 'users', userId, 'todos', todoId);

  await updateDoc(todoRef, {
    ...todoInput,
    updatedAt: serverTimestamp(),
  });
}

export async function completeTodo(todoId) {
  await updateTodo(todoId, {
    status: 'completed',
  });
}

export async function reopenTodo(todoId) {
  await updateTodo(todoId, {
    status: 'pending',
  });
}

export async function deleteTodo(todoId) {
  const userId = getCurrentUserId();
  const todoRef = doc(db, 'users', userId, 'todos', todoId);

  await deleteDoc(todoRef);
}