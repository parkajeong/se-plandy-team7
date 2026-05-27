import { useEffect, useRef, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { onAuthStateChanged, User } from "firebase/auth";
import { router } from "expo-router";
import {
  loginWithGoogle,
  loginWithIdOrEmail,
  loginWithKakao,
  signUpWithEmail,
} from "../src/authService";
import { getAppUser, subscribeAppUserChange } from "../src/appSession";
import { auth } from "../src/firebase";

export default function HomeScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAppUser, setCurrentAppUser] = useState<any | null>(getAppUser());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isKakaoLoginLoading, setIsKakaoLoginLoading] = useState(false);
  const kakaoLoginInProgressRef = useRef(false);

  const [idOrEmail, setIdOrEmail] = useState("");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setCurrentAppUser(null);
        router.replace("/(tabs)/subjects");
      }
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const storedAppUser = getAppUser();

    if (storedAppUser) {
      setCurrentAppUser(storedAppUser);
      setIsCheckingAuth(false);
      router.replace("/(tabs)/subjects");
    }

    return subscribeAppUserChange((user: any | null) => {
      setCurrentAppUser(user);
      if (user) {
        router.replace("/(tabs)/subjects");
      }
    });
  }, []);

  const handleSignUp = async () => {
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
      setIdOrEmail(email);
      setLoginId("");
      setNickname("");
      setPassword("");
      setIsSignUpMode(false);
    } catch (error: any) {
      Alert.alert("회원가입 실패", error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      Alert.alert("구글 로그인 성공");
      router.replace("/(tabs)/subjects");
    } catch (error: any) {
      Alert.alert("구글 로그인 실패", error.message);
    }
  };

  const handleKakaoLogin = async () => {
    if (kakaoLoginInProgressRef.current) {
      return;
    }

    try {
      kakaoLoginInProgressRef.current = true;
      setIsKakaoLoginLoading(true);
      const kakaoUser = await loginWithKakao();
      setCurrentAppUser(kakaoUser);
      Alert.alert("카카오 로그인 성공");
      router.replace("/(tabs)/subjects");
    } catch (error: any) {
      Alert.alert("카카오 로그인 실패", error.message);
    } finally {
      kakaoLoginInProgressRef.current = false;
      setIsKakaoLoginLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!idOrEmail || !password) {
      Alert.alert("입력 오류", "아이디 또는 이메일과 비밀번호를 입력하세요.");
      return;
    }

    try {
      await loginWithIdOrEmail(idOrEmail, password);
      Alert.alert("로그인 성공");
      router.replace("/(tabs)/subjects");
    } catch (error: any) {
      Alert.alert("로그인 실패", error.message);
    }
  };

  if (isCheckingAuth || currentUser || currentAppUser) {
    return (
      <View style={{ padding: 24, marginTop: 60 }}>
        <Text style={{ fontSize: 18 }}>로그인 상태를 확인하는 중입니다.</Text>
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

          <Button title="구글로 로그인" onPress={handleGoogleLogin} />
          <View style={{ height: 12 }} />

          <Button
            title={isKakaoLoginLoading ? "카카오 로그인 중..." : "카카오로 로그인"}
            onPress={handleKakaoLogin}
            disabled={isKakaoLoginLoading}
          />
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
