const { jest } = require('@jest/globals');

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  Timestamp: {
    fromDate: jest.fn((d) => ({ __ts: d })),
  },
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  where: jest.fn(() => ({})),
}));

jest.mock('../src/firebase', () => ({ db: {} }));

jest.mock('../src/appSession', () => ({ getCurrentAppUserId: jest.fn(() => 'user-1') }));

const {
  createTodo,
  completeTodo,
  reopenTodo,
  deleteTodo,
  fetchTodos,
} = require('../src/todoService');

const firestore = require('firebase/firestore');

describe('todoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createTodo throws when title missing', async () => {
    await expect(createTodo({ title: '', subject_id: 's1', category: '과제', deadline: '2026-06-10', priority: 3 }))
      .rejects.toThrow();
  });

  test('createTodo throws when subject_id missing', async () => {
    await expect(createTodo({ title: 'T', subject_id: '', category: '과제', deadline: '2026-06-10', priority: 3 }))
      .rejects.toThrow();
  });

  test('createTodo throws when invalid priority', async () => {
    await expect(createTodo({ title: 'T', subject_id: 's1', category: '과제', deadline: '2026-06-10', priority: 'high' }))
      .rejects.toThrow();
  });

  test('createTodo throws when invalid deadline', async () => {
    await expect(createTodo({ title: 'T', subject_id: 's1', category: '과제', deadline: '2026-13-99', priority: 3 }))
      .rejects.toThrow(/마감일/);
  });

  test('createTodo calls addDoc with expected payload', async () => {
    const addDoc = firestore.addDoc;
    addDoc.mockResolvedValue({ id: 'new-todo-id' });

    const input = { title: 'Test', subject_id: 'subject-1', category: '과제', deadline: '2026-06-10', priority: 2, description: 'desc' };

    const id = await createTodo(input);
    expect(id).toBe('new-todo-id');

    expect(addDoc).toHaveBeenCalled();
    const payload = addDoc.mock.calls[0][1];
    expect(payload.user_id).toBe('user-1');
    expect(payload.subject_id).toBe('subject-1');
    expect(payload.title).toBe('Test');
    expect(payload.is_completed).toBe(false);
    expect(payload.deadline).toHaveProperty('__ts');
    expect(payload.priority).toBe(2);
    expect(payload.created_at).toBe('SERVER_TS');
    expect(payload.description).toBe('desc');
  });

  test('completeTodo and reopenTodo call updateDoc with is_completed', async () => {
    const updateDoc = firestore.updateDoc;
    updateDoc.mockResolvedValue();

    await completeTodo('todo-1');
    expect(updateDoc).toHaveBeenCalled();
    const argsTrue = updateDoc.mock.calls[0][1];
    expect(argsTrue).toEqual({ is_completed: true });

    await reopenTodo('todo-1');
    expect(updateDoc).toHaveBeenCalledTimes(2);
    const argsFalse = updateDoc.mock.calls[1][1];
    expect(argsFalse).toEqual({ is_completed: false });
  });

  test('deleteTodo calls deleteDoc with proper doc ref and throws when id missing', async () => {
    const deleteDoc = firestore.deleteDoc;
    deleteDoc.mockResolvedValue();

    await deleteTodo('todo-123');
    expect(deleteDoc).toHaveBeenCalled();

    await expect(deleteTodo('')).rejects.toThrow('삭제할 할 일 ID가 없습니다.');
  });

  test('fetchTodos maps firestore docs to service shape and handles various date types', async () => {
    const getDocs = firestore.getDocs;

    const mockDocs = [
      { id: '1', data: () => ({ user_id: 'user-1', subject_id: 's1', title: 'A', is_completed: true, deadline: { seconds: 1700000000 }, priority: 1, created_at: { seconds: 1690000000 } }) },
      { id: '2', data: () => ({ user_id: 'user-1', subject_id: 's1', title: 'B', is_completed: false, dueDate: new Date(2026,5,12), priority: '3', created_at: new Date(2026,5,11) }) },
      { id: '3', data: () => ({ user_id: 'user-1', subject_id: 's2', title: 'C', is_completed: false, deadline_at: '2026-06-09', priority: 5, created_at: null }) },
    ];

    getDocs.mockResolvedValue({ docs: mockDocs });

    const todos = await fetchTodos();
    expect(Array.isArray(todos)).toBe(true);
    expect(todos.find((t) => t.id === '1')).toHaveProperty('deadline');
    expect(todos.find((t) => t.id === '2')).toHaveProperty('deadline');
    expect(todos.find((t) => t.id === '3')).toHaveProperty('deadline');
  });
});
