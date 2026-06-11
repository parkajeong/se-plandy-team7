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
  signInWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock('../src/firebase', () => ({ db: {}, auth: {} }));

jest.mock('../src/appSession', () => ({
  beginAppLogout: jest.fn(),
  clearAppUser: jest.fn(),
  finishAppLogout: jest.fn(),
  getCurrentAppUserIdOrNull: jest.fn(() => null),
}));

const service = require('../src/accountService');
const firestore = require('firebase/firestore');
const auth = require('firebase/auth');

describe('accountService (public API)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // default getDocs to empty list to avoid unexpected undefined
    firestore.getDocs.mockResolvedValue({ docs: [] });
  });

  test('authenticateWithPasswordForWithdraw uses email path and returns user', async () => {
    auth.signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } });

    const user = await service.authenticateWithPasswordForWithdraw({ idOrEmail: 'me@example.com', password: 'pw' });
    expect(auth.signInWithEmailAndPassword).toHaveBeenCalled();
    expect(user).toBeDefined();
    expect(user.uid).toBe('u1');
  });

  test('authenticateWithPasswordForWithdraw throws when username not found', async () => {
    // simulate resolveLoginEmail path where username lookup fails
    firestore.getDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(service.authenticateWithPasswordForWithdraw({ idOrEmail: 'missingId', password: 'pw' })).rejects.toThrow();
  });

  test('withdrawExternalAppAccount triggers cleanup flow and calls deleteDoc for users', async () => {
    // prepare mocks so cleanupUserData path runs without throwing
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    firestore.getDocs.mockResolvedValue({ docs: [] });
    firestore.deleteDoc.mockResolvedValue();

    await expect(service.withdrawExternalAppAccount({ uid: 'uid-1' })).resolves.not.toThrow();
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});
