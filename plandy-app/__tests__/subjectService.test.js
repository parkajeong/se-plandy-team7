const { jest } = require('@jest/globals');

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => 'TS'),
}));

jest.mock('../src/firebase', () => ({ db: {} }));

const service = require('../src/subjectService');
const firestore = require('firebase/firestore');

describe('subjectService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('addSubject calls addDoc and returns id', async () => {
    firestore.addDoc.mockResolvedValue({ id: 's-1' });
    const id = await service.addSubject('u1', 'Math', 'goal');
    expect(id).toBe('s-1');
    expect(firestore.addDoc).toHaveBeenCalled();
  });

  test('getSubjects maps docs', async () => {
    const docs = [{ id: 'a', data: () => ({ user_id: 'u1', title: 'T' }) }];
    firestore.getDocs.mockResolvedValue({ docs });
    const res = await service.getSubjects('u1');
    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toHaveProperty('id', 'a');
  });

  test('updateSubjectGoal calls updateDoc', async () => {
    await service.updateProgress('sub-1', 50);
    expect(firestore.updateDoc).toHaveBeenCalled();
  });

  test('deleteSubject calls deleteDoc', async () => {
    await service.deleteSubject('sub-2');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});
