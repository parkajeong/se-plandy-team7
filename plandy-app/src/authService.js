import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: "116925888955-o5mak3tjasjbb27np3l74b2kqhoint81.apps.googleusercontent.com",
});

export const signUpWithEmail = async ({ email, password, loginId, nickname }) => {
  const trimmedEmail = email.trim();
  const trimmedLoginId = loginId.trim();
  const trimmedNickname = nickname.trim();

  if (!trimmedEmail || !password || !trimmedLoginId || !trimmedNickname) {
    throw new Error("모든 항목을 입력해주세요.");
  }

  if (trimmedLoginId.includes("@")) {
    throw new Error("아이디에는 @를 사용할 수 없습니다.");
  }

  const loginIdRegex = /^[a-zA-Z0-9_]{4,20}$/;

  if (!loginIdRegex.test(trimmedLoginId)) {
    throw new Error("아이디는 영문, 숫자, 밑줄(_) 포함 4~20자로 입력해주세요.");
  }

  const usernameRef = doc(db, "usernames", trimmedLoginId);
  const usernameSnap = await getDoc(usernameRef);

  if (usernameSnap.exists()) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    trimmedEmail,
    password
  );

  const user = userCredential.user;

  await runTransaction(db, async (transaction) => {
    const usernameDoc = await transaction.get(usernameRef);

    if (usernameDoc.exists()) {
      throw new Error("이미 사용 중인 아이디입니다.");
    }

    const userRef = doc(db, "users", user.uid);

    transaction.set(userRef, {
      uid: user.uid,
      email: trimmedEmail,
      loginId: trimmedLoginId,
      nickname: trimmedNickname,
      provider: "email",
      created_at: serverTimestamp(),
    });

    transaction.set(usernameRef, {
      uid: user.uid,
      email: trimmedEmail,
      created_at: serverTimestamp(),
    });
  });

  return user;
};

export const loginWithIdOrEmail = async (idOrEmail, password) => {
  let loginEmail = idOrEmail.trim();

  if (!loginEmail || !password) {
    throw new Error("아이디 또는 이메일과 비밀번호를 입력해주세요.");
  }

  if (!loginEmail.includes("@")) {
    const usernameRef = doc(db, "usernames", loginEmail);
    const usernameSnap = await getDoc(usernameRef);

    if (!usernameSnap.exists()) {
      throw new Error("존재하지 않는 아이디입니다.");
    }

    const usernameData = usernameSnap.data();
    loginEmail = usernameData.email;
  }

  const userCredential = await signInWithEmailAndPassword(
    auth,
    loginEmail,
    password
  );

  return userCredential.user;
};

export const logout = async () => {
  await signOut(auth);
};

export const loginWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();

  const googleUser = await GoogleSignin.signIn();

  const idToken = googleUser.data?.idToken || googleUser.idToken;

  if (!idToken) {
    throw new Error("구글 로그인 토큰을 가져오지 못했습니다.");
  }

  const googleCredential = GoogleAuthProvider.credential(idToken);

  const userCredential = await signInWithCredential(auth, googleCredential);
  const user = userCredential.user;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      loginId: "",
      nickname: user.displayName || "",
      provider: "google",
      created_at: serverTimestamp(),
    });
  }

  return user;
};