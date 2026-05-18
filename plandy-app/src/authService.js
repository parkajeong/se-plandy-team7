import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { clearAppUser, setAppUser } from "./appSession";

WebBrowser.maybeCompleteAuthSession();

GoogleSignin.configure({
  webClientId: "116925888955-o5mak3tjasjbb27np3l74b2kqhoint81.apps.googleusercontent.com",
});

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const KAKAO_REDIRECT_URI = "http://localhost:8081/kakao-auth";

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
  await clearAppUser();
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

const createKakaoUserDocumentIfNeeded = async (user) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      loginId: "",
      nickname: user.nickname || "",
      provider: "kakao",
      kakaoId: user.kakaoId,
      created_at: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    userRef,
    {
      email: user.email || "",
      nickname: user.nickname || "",
      provider: "kakao",
      kakaoId: user.kakaoId,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
};

const exchangeKakaoCodeForToken = async ({ code, redirectUri }) => {
  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });

  const tokenResult = await response.json();

  if (!response.ok) {
    throw new Error(tokenResult.error_description || "카카오 토큰 발급에 실패했습니다.");
  }

  return tokenResult.access_token;
};

const fetchKakaoUser = async (accessToken) => {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });

  const profile = await response.json();

  if (!response.ok) {
    throw new Error(profile.msg || "카카오 사용자 정보를 가져오지 못했습니다.");
  }

  const kakaoAccount = profile.kakao_account || {};
  const profileInfo = kakaoAccount.profile || {};
  const kakaoId = String(profile.id);

  return {
    uid: `kakao:${kakaoId}`,
    kakaoId,
    email: kakaoAccount.email || "",
    nickname: profileInfo.nickname || profile.properties?.nickname || "Kakao User",
    provider: "kakao",
  };
};

export const loginWithKakao = async () => {
  console.log("[loginWithKakao] service entered", {
    hasRestApiKey: Boolean(KAKAO_REST_API_KEY),
  });
  if (!KAKAO_REST_API_KEY) {
    throw new Error("EXPO_PUBLIC_KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  }

  const redirectUri = KAKAO_REDIRECT_URI;
  console.log("[loginWithKakao] redirectUri", redirectUri);
  const authUrl =
    "https://kauth.kakao.com/oauth/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
    }).toString();

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== "success") {
    throw new Error("카카오 로그인이 취소되었습니다.");
  }

  const parsedUrl = Linking.parse(result.url);
  const rawCode = parsedUrl.queryParams?.code;
  const rawError = parsedUrl.queryParams?.error_description || parsedUrl.queryParams?.error;
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (!code) {
    throw new Error(
      Array.isArray(rawError) ? rawError[0] : rawError || "카카오 인증 코드를 받지 못했습니다."
    );
  }

  const accessToken = await exchangeKakaoCodeForToken({ code, redirectUri });
  const kakaoUser = await fetchKakaoUser(accessToken);

  await createKakaoUserDocumentIfNeeded(kakaoUser);
  await setAppUser(kakaoUser);

  return kakaoUser;
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

  await createGoogleUserDocumentIfNeeded(user);

  return user;
};
