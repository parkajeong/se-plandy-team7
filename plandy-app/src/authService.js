import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const isWeb = Platform.OS === "web";

if (!isWeb) {
  GoogleSignin.configure({
    webClientId: googleWebClientId,
  });
}

export const signUpWithEmail = async ({ email, password, loginId, nickname }) => {
  console.log("[signUpWithEmail] called", {
    email,
    loginId,
    nickname,
    passwordLength: password?.length ?? 0,
  });

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
  if (!isWeb) {
    await GoogleSignin.signOut().catch(() => {});
  }

  await signOut(auth);
};

const createGoogleUserDocumentIfNeeded = async (user) => {
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
};

export const loginWithGoogle = async () => {
  if (isWeb) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    await createGoogleUserDocumentIfNeeded(user);

    return user;
  }

  if (!googleWebClientId) {
    throw new Error("Google Web Client ID가 설정되지 않았습니다.");
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const googleUser = await GoogleSignin.signIn();

    if (isCancelledResponse(googleUser)) {
      throw new Error("Google 로그인이 취소되었습니다.");
    }

    const idToken = googleUser.data?.idToken;

    if (!idToken) {
      throw new Error(
        "Google ID 토큰을 받지 못했습니다. Firebase의 Android OAuth 클라이언트/SHA 설정을 확인하세요."
      );
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);

    const userCredential = await signInWithCredential(auth, googleCredential);
    const user = userCredential.user;

    await createGoogleUserDocumentIfNeeded(user);

    return user;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error("Google 로그인이 취소되었습니다.");
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play Services를 사용할 수 없습니다.");
      }

      if (error.code === "10") {
        throw new Error(
          "Google 로그인 설정 오류입니다. Firebase에 앱의 SHA-1/SHA-256을 등록하고 google-services.json을 다시 받아야 합니다."
        );
      }
    }

    throw error;
  }
};
