const { jest } = require('@jest/globals');

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  deleteUser: jest.fn(),
}));

jest.mock('../src/firebase', () => ({ db: {}, auth: {} }));

const service = require('../src/accountService');
const firestore = require('firebase/firestore');

describe('accountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveLoginEmail returns input email when contains @', async () => {
    const email = await service.resolveLoginEmail('me@example.com');
    expect(email).toBe('me@example.com');
  });

  test('resolveLoginEmail looks up username and throws when not found', async () => {
    // username path: getDoc(doc(db, 'usernames', trimmedId))
    firestore.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(service.resolveLoginEmail('missingId')).rejects.toThrow();
  });

  test('deleteUsernameDocuments removes usernames and queries by uid/email', async () => {
    // getDoc for user returns user data with username/loginId
    firestore.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ username: 'u1', loginId: 'lid' }) });
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await service.deleteUsernameDocuments('uid-1', { email: 'a@b.com' });
    // should attempt to delete username docs (deleteDoc called inside)
    // deleteDoc is used in implementation; ensure getDoc was called for users
    expect(firestore.getDoc).toHaveBeenCalled();
  });

  test('cleanupStudyGroups deletes group when user is host and removes member when not', async () => {
    const groupDocHost = { id: 'g1', ref: 'ref1', data: () => ({ host_id: 'uid-1', schedules: [] }) };
    const groupDocMember = { id: 'g2', ref: 'ref2', data: () => ({ host_id: 'other', members: ['uid-1'], schedules: [{ created_by: 'uid-1' }, { created_by: 'x' }] }) };

    firestore.getDocs.mockResolvedValueOnce({ docs: [groupDocHost, groupDocMember] });
    firestore.deleteDoc.mockResolvedValue();
    firestore.updateDoc.mockResolvedValue();

    await service.cleanupStudyGroups('uid-1');

    // for host group, deleteDoc should be called
    expect(firestore.deleteDoc).toHaveBeenCalled();
    // for member group, updateDoc should be called to remove member
    expect(firestore.updateDoc).toHaveBeenCalled();
  });
});
