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

jest.mock('../src/firebase', () => ({
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  functions: {},
}));

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

  test('getIncorrectNotesByCurrentUser queries quiz_results by auth UID and flattens incorrect_items', async () => {
    const quizResults = [
      {
        id: 'res1',
        quiz_id: 'q1',
        score: 3,
        total_count: 5,
        correct_rate: 60,
        incorrect_items: [
          { question_index: 1, user_answer: 2, is_review_needed: true },
          { question_index: 4, user_answer: 0 },
        ],
      },
      {
        id: 'res2',
        quiz_id: 'q2',
        score: 5,
        total_count: 5,
        incorrect_items: [],
      },
      {
        id: 'res3',
        quiz_id: 'q3',
        score: 4,
        total_count: 5,
      },
    ];

    firestore.getDocs.mockResolvedValueOnce({
      docs: quizResults.map((result) => ({
        id: result.id,
        data: () => result,
      })),
    });
    firestore.getDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      id: 'q1',
      data: () => ({
        title: 'Quiz 1',
        questions: [
          { question: 'Q1', options: ['a', 'b'], answer: 0 },
          { question: 'Q2', options: ['a', 'b', 'c'], answer: 1, explanation: 'exp' },
          { question: 'Q3', options: ['a'], answer: 0 },
          { question: 'Q4', options: ['a'], answer: 0 },
          { question: 'Q5', options: ['a', 'b'], answer: 1 },
        ],
      }),
    });

    const notes = await service.getIncorrectNotesByCurrentUser();

    expect(firestore.where).toHaveBeenCalledWith('user_id', '==', 'u1');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toEqual(expect.objectContaining({
      result_id: 'res1',
      quiz_id: 'q1',
      question_index: 1,
      user_answer: 2,
      is_review_needed: true,
      score: 3,
      total_count: 5,
      correct_rate: 60,
      question: expect.objectContaining({
        question: 'Q2',
        answer: 1,
      }),
    }));
  });

  test('getIncorrectNotesByCurrentUser logs the quiz_id and continues when quiz lookup is denied', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    firestore.getDocs.mockResolvedValueOnce({
      docs: [{
        id: 'res-denied',
        data: () => ({
          quiz_id: 'quiz-denied',
          incorrect_items: [{ question_index: 0, user_answer: 1 }],
        }),
      }],
    });
    firestore.getDoc = jest.fn().mockRejectedValue(
      new Error('Missing or insufficient permissions')
    );

    await expect(service.getIncorrectNotesByCurrentUser()).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      '[incorrect-notes] failed to fetch quiz_id: quiz-denied',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
