import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
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
const KAKAO_WEB_CALLBACK_ORIGIN = new URL(KAKAO_REDIRECT_URI).origin;
const KAKAO_APP_RETURN_URI = "plandy://kakao-auth";
const KAKAO_AUTH_PROMPT = "select_account";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let isGoogleSigninConfigured = false;

const configureNativeGoogleSignIn = () => {
  if (isGoogleSigninConfigured) {
    return;
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID가 설정되지 않았습니다.");
  }

  const config = {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  };

  if (Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID) {
    config.iosClientId = GOOGLE_IOS_CLIENT_ID;
  }

  GoogleSignin.configure(config);
  isGoogleSigninConfigured = true;
};

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

  if (!isWeb && isGoogleSigninConfigured) {
    await GoogleSignin.signOut().catch(() => null);
  }

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

const openKakaoAuthPopup = (authUrl) => {
  if (typeof window === "undefined") {
    throw new Error("웹 브라우저 환경에서만 카카오 팝업 로그인을 사용할 수 있습니다.");
  }

  let settled = false;
  const popupWidth = 480;
  const popupHeight = 720;
  const popupLeft = window.screenX + (window.outerWidth - popupWidth) / 2;
  const popupTop = window.screenY + (window.outerHeight - popupHeight) / 2;

  return new Promise((resolve, reject) => {
    let popup = null;
    let popupClosedInterval = null;

    const cleanup = () => {
      if (popupClosedInterval) {
        window.clearInterval(popupClosedInterval);
      }

      window.removeEventListener("message", handleMessage);
    };

    const finishWithError = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const finishWithCode = (code) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(code);
    };

    const handleMessage = (event) => {
      if (
        event.origin !== KAKAO_WEB_CALLBACK_ORIGIN ||
        event.data?.source !== "plandy-kakao-auth"
      ) {
        return;
      }

      popup?.close();

      if (event.data.error) {
        finishWithError(
          new Error(
            event.data.errorDescription ||
              event.data.error ||
              "카카오 로그인 중 오류가 발생했습니다."
          )
        );
        return;
      }

      if (!event.data.code) {
        finishWithError(new Error("카카오 인가 코드를 가져오지 못했습니다."));
        return;
      }

      finishWithCode(event.data.code);
    };

    window.addEventListener("message", handleMessage);

    popup = window.open(
      authUrl,
      "plandy-kakao-login",
      [
        `width=${popupWidth}`,
        `height=${popupHeight}`,
        `left=${Math.max(0, popupLeft)}`,
        `top=${Math.max(0, popupTop)}`,
        "resizable=yes",
        "scrollbars=yes",
      ].join(",")
    );

    if (!popup) {
      finishWithError(
        new Error("카카오 로그인 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.")
      );
      return;
    }

    popup.focus();

    popupClosedInterval = window.setInterval(() => {
      if (!settled && popup.closed) {
        finishWithError(new Error("카카오 로그인이 완료되지 않았습니다."));
      }
    }, 500);
  });
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
  console.log("[Kakao] appReturnUri:", KAKAO_APP_RETURN_URI);

  const authUrl =
    "https://kauth.kakao.com/oauth/authorize?" +
    `response_type=code` +
    `&client_id=${encodeURIComponent(restApiKey)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&prompt=${encodeURIComponent(KAKAO_AUTH_PROMPT)}`;

  let code;

  if (isWeb) {
    code = await openKakaoAuthPopup(authUrl);
  } else {
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      KAKAO_APP_RETURN_URI
    );
    console.log("[Kakao] auth result:", result);

    if (result.type !== "success") {
      throw new Error("카카오 로그인이 완료되지 않았습니다.");
    }

    const resultUrl = new URL(result.url);
    const error = resultUrl.searchParams.get("error");
    const errorDescription = resultUrl.searchParams.get("error_description");

    if (error) {
      throw new Error(errorDescription || error);
    }

    code = resultUrl.searchParams.get("code");
  }

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

  configureNativeGoogleSignIn();

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const signInResponse = await GoogleSignin.signIn();

    if (signInResponse.type !== "success") {
      throw new Error("Google 로그인이 취소되었습니다.");
    }

    const idToken =
      signInResponse.data.idToken || (await GoogleSignin.getTokens()).idToken;

    return loginWithGoogleIdToken(idToken);
  } catch (error) {
    if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Google 로그인이 취소되었습니다.");
    }

    if (error?.code === statusCodes.IN_PROGRESS) {
      throw new Error("Google 로그인이 이미 진행 중입니다.");
    }

    if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services를 사용할 수 없습니다.");
    }

    throw error;
  }
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
