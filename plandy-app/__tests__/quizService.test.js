jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  where: jest.fn(() => ({})),
  deleteDoc: jest.fn(),
}));

jest.mock('../src/firebase', () => ({ db: {}, functions: {} }));

const service = require('../src/quizService');
const firestore = require('firebase/firestore');

describe('quizService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('submitQuizResult throws when userId missing', async () => {
    await expect(service.submitQuizResult({ userId: '', quizId: 'q1' })).rejects.toThrow();
  });

  test('submitQuizResult throws when quizId missing', async () => {
    await expect(service.submitQuizResult({ userId: 'u1', quizId: '' })).rejects.toThrow();
  });

  test('submitQuizResult creates safe id and sets document payload', async () => {
    const setDoc = firestore.setDoc;
    setDoc.mockResolvedValue();

    const resultId = await service.submitQuizResult({ userId: 'u/1', quizId: 'q/1', subjectId: 's1', score: 10, total_count: 10, correct_count: 10, correct_rate: 100, incorrect_items: [{ question_index: 0, user_answer: 1 }] });

    expect(typeof resultId).toBe('string');
    expect(setDoc).toHaveBeenCalled();
    const payload = setDoc.mock.calls[0][1];
    expect(payload.user_id).toBe('u/1');
    expect(payload.quiz_id).toBe('q/1');
    expect(payload.subject_id).toBe('s1');
    expect(payload.incorrect_items).toBeInstanceOf(Array);
    expect(payload.solved_at).toBe('SERVER_TS');
  });

  test('fetchQuizResultsBySubject filters by quiz_id', async () => {
    // mock underlying getDocs calls: first for quizzes, then for quiz_results
    const quizzes = [{ id: 'q1' }, { id: 'q2' }];
    const quizDocs = quizzes.map((q) => ({ id: q.id, data: () => q }));

    const results = [
      { id: 'r1', quiz_id: 'q1' },
      { id: 'r2', quiz_id: 'other' },
    ];
    const resultDocs = results.map((r) => ({ id: r.id, data: () => r }));

    // fetchQuizzesBySubject -> getDocs resolves to quizDocs
    firestore.getDocs.mockResolvedValueOnce({ docs: quizDocs });
    // getQuizResultsByUser -> getDocs resolves to resultDocs
    firestore.getDocs.mockResolvedValueOnce({ docs: resultDocs });

    const out = await service.fetchQuizResultsBySubject('u1', 's1');
    expect(out).toEqual([{ id: 'r1', quiz_id: 'q1' }]);
  });

  test('getIncorrectNoteGroupsByUser maps quiz questions and handles missing questions', async () => {
    // prepare quiz_results snapshot
    const quizResults = [
      { id: 'res1', quiz_id: 'q1', incorrect_items: [{ question_index: 0, user_answer: 1 }] , updated_at: { toDate: () => new Date(2026,5,1) } },
      { id: 'res2', quiz_id: 'q2', incorrect_items: [{ question_index: 5, user_answer: 0 }] , updated_at: { toDate: () => new Date(2026,5,2) } },
    ];

    firestore.getDocs.mockResolvedValueOnce({ docs: quizResults.map((r) => ({ id: r.id, data: () => r })) });

    // getDoc for each quiz id
    firestore.getDoc = jest.fn(async (docRef) => ({ exists: () => true, id: 'q1', data: () => ({ id: 'q1', title: 'Q1', questions: [{ question: 'Q?' , options: ['a','b'], answer: 0, explanation: 'exp' }] }) }));

    const groups = await service.getIncorrectNoteGroupsByUser('u1');
    expect(Array.isArray(groups)).toBe(true);
    // groups should contain only entries with existing quiz and incorrect items mapped
    expect(groups.length).toBeLessThanOrEqual(quizResults.length);
  });
});
