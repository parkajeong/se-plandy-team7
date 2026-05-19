import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Platform, Text, TextInput, View } from "react-native";
import { onAuthStateChanged, User } from "firebase/auth";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  loginWithIdOrEmail,
  signUpWithEmail,
  logout,
  loginWithGoogle,
  loginWithGoogleIdToken,
} from "../../src/authService";
import { auth } from "../../src/firebase";

WebBrowser.maybeCompleteAuthSession();

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export default function HomeScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const isWeb = Platform.OS === "web";
  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: "plandy", path: "oauthredirect" }),
    []
  );
  const [googleRequest, googleResponse, promptGoogleLogin] =
    Google.useAuthRequest({
      webClientId: googleWebClientId,
      androidClientId: googleAndroidClientId || googleWebClientId,
      iosClientId: googleIosClientId || googleWebClientId,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      selectAccount: true,
    });

  // 로그인: 아이디 또는 이메일
  // 회원가입: 이메일
  const [idOrEmail, setIdOrEmail] = useState("");
  const [email, setEmail] = useState("");

  // 회원가입할 때만 사용
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const loginWithGoogleResponse = async () => {
      if (isWeb || !googleResponse) {
        return;
      }

      if (googleResponse.type !== "success") {
        if (googleResponse.type === "error") {
          Alert.alert(
            "구글 로그인 실패",
            googleResponse.params?.error_description ||
              googleResponse.params?.error ||
              "Google 인증 중 오류가 발생했습니다."
          );
        }

        return;
      }

      const idToken =
        googleResponse.params?.id_token || googleResponse.authentication?.idToken;

      if (!idToken && googleResponse.params?.code) {
        return;
      }

      try {
        await loginWithGoogleIdToken(idToken);
        Alert.alert("구글 로그인 성공");
      } catch (error: any) {
        Alert.alert("구글 로그인 실패", error.message);
      }
    };

    loginWithGoogleResponse();
  }, [googleResponse, isWeb]);

  const handleSignUp = async () => {
    console.log("[handleSignUp] clicked", {
      email,
      loginId,
      nickname,
      passwordLength: password.length,
    });
    if (!email || !password || !nickname || !loginId) {
      Alert.alert("입력 오류", "아이디, 이메일, 비밀번호, 닉네임을 모두 입력하세요.");
      return;
    }

    try {
      await signUpWithEmail({
        email,
        password,
        loginId,
        nickname,
      });

      Alert.alert("회원가입 성공");
      setIsSignUpMode(false);

      // 회원가입 후 로그인 입력칸에 이메일 자동 입력
      setIdOrEmail(email);

      // 회원가입 입력값 초기화
      setLoginId("");
      setNickname("");
      setPassword("");
    } catch (error: any) {
      Alert.alert("회원가입 실패", error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      if (isWeb) {
        await loginWithGoogle();
        Alert.alert("구글 로그인 성공");
        return;
      }

      if (!googleWebClientId) {
        throw new Error("Google Web Client ID가 설정되지 않았습니다.");
      }

      if (Platform.OS === "android" && !googleAndroidClientId) {
        throw new Error("Google Android Client ID가 설정되지 않았습니다.");
      }

      if (!googleRequest) {
        throw new Error("Google 로그인 요청을 준비하는 중입니다. 잠시 후 다시 시도해주세요.");
      }

      const result = await promptGoogleLogin();

      if (result.type !== "success") {
        throw new Error("Google 로그인이 취소되었습니다.");
      }
    } catch (error: any) {
      Alert.alert("구글 로그인 실패", error.message);
    }
  };

  const handleKakaoLogin = async () => {
    Alert.alert(
      "준비 중",
      "카카오 로그인은 Firebase Custom Token 서버 연동 후 구현 예정입니다."
    );
  };

  const handleLogin = async () => {
    if (!idOrEmail || !password) {
      Alert.alert("입력 오류", "아이디 또는 이메일과 비밀번호를 입력하세요.");
      return;
    }

    try {
      await loginWithIdOrEmail(idOrEmail, password);
      Alert.alert("로그인 성공");
    } catch (error: any) {
      Alert.alert("로그인 실패", error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();

      setIdOrEmail("");
      setEmail("");
      setLoginId("");
      setNickname("");
      setPassword("");
      setShowPassword(false);
      setIsSignUpMode(false);

      Alert.alert("로그아웃 성공");
    } catch (error: any) {
      Alert.alert("로그아웃 실패", error.message);
    }
  };

  // 로그인 상태일 때 보여줄 테스트용 빈 화면
  if (currentUser) {
    return (
      <View style={{ padding: 24, marginTop: 60 }}>
        <Text style={{ fontSize: 24, marginBottom: 20 }}>
          테스트용 로그인 완료 화면
        </Text>

        <Text style={{ marginBottom: 8 }}>로그인 상태입니다.</Text>

        <Text style={{ marginBottom: 20 }}>
          현재 계정: {currentUser.email}
        </Text>

        <Button title="로그아웃" onPress={handleLogout} />
      </View>
    );
  }

  return (
    <View style={{ padding: 24, marginTop: 60 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        {isSignUpMode ? "회원가입" : "로그인"}
      </Text>

      {isSignUpMode ? (
        <>
          <TextInput
            placeholder="아이디"
            value={loginId}
            onChangeText={setLoginId}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
            }}
          />

          <TextInput
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
            }}
          />
        </>
      ) : (
        <TextInput
          placeholder="아이디 또는 이메일"
          value={idOrEmail}
          onChangeText={setIdOrEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            borderWidth: 1,
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
          }}
        />
      )}

      <View
        style={{
          borderWidth: 1,
          marginBottom: 12,
          borderRadius: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TextInput
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{
            flex: 1,
            padding: 12,
          }}
        />

        <Text
          onPress={() => setShowPassword(!showPassword)}
          style={{
            paddingHorizontal: 12,
            color: "blue",
          }}
        >
          {showPassword ? "숨기기" : "보기"}
        </Text>
      </View>

      {isSignUpMode && (
        <TextInput
          placeholder="닉네임"
          value={nickname}
          onChangeText={setNickname}
          style={{
            borderWidth: 1,
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
          }}
        />
      )}

      {isSignUpMode ? (
        <Button title="회원가입" onPress={handleSignUp} />
      ) : (
        <Button title="로그인" onPress={handleLogin} />
      )}

      {!isSignUpMode && (
        <>
          <View style={{ height: 12 }} />

          <Button
            title="구글로 로그인"
            onPress={handleGoogleLogin}
            disabled={!isWeb && !googleRequest}
          />
          <View style={{ height: 12 }} />

          <Button title="카카오로 로그인" onPress={handleKakaoLogin} />
        </>
      )}

      <View style={{ height: 12 }} />

      <Button
        title={isSignUpMode ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}
        onPress={() => {
          setIsSignUpMode(!isSignUpMode);
          setPassword("");
        }}
      />
    </View>
  );
}
