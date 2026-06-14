process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY = "test-kakao-rest-api-key";

const mockAuth = { currentUser: null };
const mockDb = {};
const mockFunctions = {};
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignInWithCustomToken = jest.fn();
const mockHttpsCallable = jest.fn();
const mockGetDoc = jest.fn();
const mockRunTransaction = jest.fn();
const mockSetDoc = jest.fn();
const mockSetAppUser = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args) => mockOpenAuthSessionAsync(...args),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {},
  statusCodes: {},
}));

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args) =>
    mockCreateUserWithEmailAndPassword(...args),
  GoogleAuthProvider: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithCustomToken: (...args) => mockSignInWithCustomToken(...args),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

jest.mock("firebase/firestore", () => ({
  doc: (_db, collectionName, id) => ({ collectionName, id }),
  getDoc: (...args) => mockGetDoc(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  serverTimestamp: () => "server-timestamp",
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: jest.fn(),
}));

jest.mock("../src/appSession", () => ({
  cancelAppLogout: jest.fn(),
  setAppUser: (...args) => mockSetAppUser(...args),
}));

jest.mock("../src/firebase", () => ({
  auth: mockAuth,
  db: mockDb,
  functions: mockFunctions,
}));

const { signInWithKakaoOnly, signUpWithEmail } = require("../src/authService");

describe("authService Firebase authentication ordering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    global.fetch = jest.fn();
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue();
  });

  test("email signup authenticates before writing users document with Firebase uid", async () => {
    const firebaseUser = {
      uid: "firebase-email-uid",
      email: "student@example.com",
      photoURL: "",
      getIdToken: jest.fn().mockResolvedValue("id-token"),
    };
    const transaction = {
      get: jest.fn().mockResolvedValue({ exists: () => false }),
      set: jest.fn(),
    };

    mockCreateUserWithEmailAndPassword.mockImplementation(async () => {
      mockAuth.currentUser = firebaseUser;
      return { user: firebaseUser };
    });
    mockGetDoc.mockImplementation(async () => {
      expect(mockAuth.currentUser).toBe(firebaseUser);
      return { exists: () => false };
    });
    mockRunTransaction.mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await signUpWithEmail({
      email: " student@example.com ",
      password: "password",
      loginId: "student_1",
      nickname: "Student",
    });

    expect(firebaseUser.getIdToken).toHaveBeenCalled();
    expect(transaction.set).toHaveBeenCalledWith(
      { collectionName: "users", id: "firebase-email-uid" },
      expect.objectContaining({ uid: "firebase-email-uid", provider: "email" })
    );
  });

  test("Kakao signs into Firebase before writing users document with Firebase uid", async () => {
    const firebaseUser = {
      uid: "firebase-kakao-uid",
      email: null,
      displayName: null,
      photoURL: null,
      getIdToken: jest.fn().mockResolvedValue("id-token"),
    };
    const kakaoProfile = {
      kakaoId: "12345",
      email: "kakao@example.com",
      nickname: "Kakao User",
      photoURL: "https://example.com/photo.png",
    };
    const callable = jest.fn().mockResolvedValue({
      data: { customToken: "firebase-custom-token", user: kakaoProfile },
    });

    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "plandy://kakao-auth?code=authorization-code",
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "kakao-access-token" }),
    });
    mockHttpsCallable.mockReturnValue(callable);
    mockSignInWithCustomToken.mockImplementation(async () => {
      mockAuth.currentUser = firebaseUser;
      return { user: firebaseUser };
    });
    mockGetDoc.mockImplementation(async (ref) => {
      expect(mockAuth.currentUser).toBe(firebaseUser);
      expect(ref).toEqual({
        collectionName: "users",
        id: "firebase-kakao-uid",
      });
      return { exists: () => false };
    });

    const result = await signInWithKakaoOnly();

    expect(callable).toHaveBeenCalledWith({ accessToken: "kakao-access-token" });
    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(
      mockAuth,
      "firebase-custom-token"
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      { collectionName: "users", id: "firebase-kakao-uid" },
      expect.objectContaining({
        uid: "firebase-kakao-uid",
        kakaoId: "12345",
        provider: "kakao",
      })
    );
    expect(result.uid).toBe("firebase-kakao-uid");
    expect(mockSetAppUser).toHaveBeenCalledWith(result);
  });
});
