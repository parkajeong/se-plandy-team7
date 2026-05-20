import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { clearAppUser, setAppUser } from "./appSession";
import { auth, db } from "./firebase";

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === "web";

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const KAKAO_REDIRECT_URI = "https://se-plandy-app.vercel.app/kakao-auth.html";

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
      photoURL: user.photoURL || "",
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
  const photoURL = user.photoURL || "";

  console.log("[Google] login user.photoURL:", photoURL);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      loginId: "",
      nickname: user.displayName || "",
      photoURL,
      provider: "google",
      created_at: serverTimestamp(),
    });

    console.log("[Google] created users/{uid} photoURL:", photoURL);
    return;
  }

  await updateDoc(userRef, {
    email: user.email || "",
    nickname: user.displayName || "",
    photoURL,
    provider: "google",
    updated_at: serverTimestamp(),
  });

  console.log("[Google] updated users/{uid} photoURL:", photoURL);
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
      photoURL: user.photoURL || "",
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
      photoURL: user.photoURL || "",
      provider: "kakao",
      kakaoId: user.kakaoId,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
};

const exchangeKakaoCodeForToken = async ({ code, redirectUri }) => {
  const restApiKey = KAKAO_REST_API_KEY;

  console.log("[Kakao] token request", {
    grantType: "authorization_code",
    restApiKeyExists: !!restApiKey,
    redirectUri,
    codeExists: !!code,
    codePreview: code ? `${code.slice(0, 10)}...` : null,
  });

  const tokenRequestBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: restApiKey,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: tokenRequestBody.toString(),
  });

  const tokenData = await response.json();
  console.log("[Kakao] token response", {
    status: response.status,
    ok: response.ok,
    tokenData,
  });

  if (!response.ok) {
    throw new Error(tokenData.error_description || tokenData.error || "카카오 토큰 발급에 실패했습니다.");
  }

  return tokenData.access_token;
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
    photoURL:
      profileInfo.profile_image_url ||
      profileInfo.thumbnail_image_url ||
      profile.properties?.profile_image ||
      profile.properties?.thumbnail_image ||
      "",
    provider: "kakao",
  };
};

export const loginWithKakao = async () => {
  const restApiKey = KAKAO_REST_API_KEY;

  console.log("[loginWithKakao] service entered", {
    hasRestApiKey: !!restApiKey,
  });

  if (!restApiKey) {
    throw new Error("EXPO_PUBLIC_KAKAO_REST_API_KEY가 설정되지 않았습니다.");
  }

  const redirectUri = KAKAO_REDIRECT_URI;

  console.log("[Kakao] restApiKey exists:", !!restApiKey);
  console.log("[Kakao] redirectUri:", redirectUri);

  const authUrl =
    "https://kauth.kakao.com/oauth/authorize?" +
    `response_type=code` +
    `&client_id=${encodeURIComponent(restApiKey)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  console.log("[Kakao] auth result:", result);

  if (result.type !== "success") {
    throw new Error("카카오 로그인이 완료되지 않았습니다.");
  }

  const code = new URL(result.url).searchParams.get("code");

  console.log("[Kakao] code exists:", !!code);

  if (!code) {
    throw new Error("카카오 인가 코드를 가져오지 못했습니다.");
  }

  const accessToken = await exchangeKakaoCodeForToken({ code, redirectUri });
  const kakaoUser = await fetchKakaoUser(accessToken);

  await createKakaoUserDocumentIfNeeded(kakaoUser);
  await setAppUser(kakaoUser);

  return kakaoUser;
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

  throw new Error("앱 Google 로그인은 Expo AuthSession 훅에서 처리해야 합니다.");
};

export const loginWithGoogleIdToken = async (idToken) => {
  if (!idToken) {
    throw new Error("Google ID 토큰을 받지 못했습니다. Firebase 설정을 확인하세요.");
  }

  const googleCredential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, googleCredential);
  const user = userCredential.user;

  await createGoogleUserDocumentIfNeeded(user);

  return user;
};
