import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";

import {
  loginWithGoogle,
  loginWithIdOrEmail,
  loginWithKakao,
  signUpWithEmail,
} from "../src/authService";

const MAIN_ROUTE = "/(tabs)/subjects";

export default function HomeScreen() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isKakaoLoginLoading, setIsKakaoLoginLoading] = useState(false);
  const kakaoLoginInProgressRef = useRef(false);

  const [idOrEmail, setIdOrEmail] = useState("");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !nickname || !loginId) {
      Alert.alert("입력 오류", "아이디, 이메일, 비밀번호, 닉네임을 모두 입력해주세요.");
      return;
    }

    try {
      await signUpWithEmail({ email, password, loginId, nickname });
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
      Alert.alert("Google 로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      Alert.alert("Google 로그인 실패", error.message);
    }
  };

  const handleKakaoLogin = async () => {
    if (kakaoLoginInProgressRef.current) {
      return;
    }

    try {
      kakaoLoginInProgressRef.current = true;
      setIsKakaoLoginLoading(true);
      await loginWithKakao();
      Alert.alert("카카오 로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      Alert.alert("카카오 로그인 실패", error.message);
    } finally {
      kakaoLoginInProgressRef.current = false;
      setIsKakaoLoginLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!idOrEmail || !password) {
      Alert.alert("입력 오류", "아이디 또는 이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      await loginWithIdOrEmail(idOrEmail, password);
      Alert.alert("로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      Alert.alert("로그인 실패", error.message);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>{isSignUpMode ? "회원가입" : "로그인"}</Text>

      {isSignUpMode ? (
        <>
          <TextInput
            placeholder="아이디"
            value={loginId}
            onChangeText={setLoginId}
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </>
      ) : (
        <TextInput
          placeholder="아이디 또는 이메일"
          value={idOrEmail}
          onChangeText={setIdOrEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
      )}

      <View style={styles.passwordBox}>
        <TextInput
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
        />

        <Text
          onPress={() => setShowPassword(!showPassword)}
          style={styles.passwordToggle}
        >
          {showPassword ? "숨기기" : "보기"}
        </Text>
      </View>

      {isSignUpMode && (
        <TextInput
          placeholder="닉네임"
          value={nickname}
          onChangeText={setNickname}
          style={styles.input}
        />
      )}

      {isSignUpMode ? (
        <Button title="회원가입" onPress={handleSignUp} />
      ) : (
        <Button title="로그인" onPress={handleLogin} />
      )}

      {!isSignUpMode && (
        <>
          <View style={styles.spacer} />
          <Button title="Google로 로그인" onPress={handleGoogleLogin} />
          <View style={styles.spacer} />
          <Button
            title={isKakaoLoginLoading ? "카카오 로그인 중..." : "카카오로 로그인"}
            onPress={handleKakaoLogin}
            disabled={isKakaoLoginLoading}
          />
        </>
      )}

      <View style={styles.spacer} />

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

const styles = StyleSheet.create({
  formContainer: {
    marginTop: 60,
    padding: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  passwordBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
  },
  passwordToggle: {
    color: "blue",
    paddingHorizontal: 12,
  },
  spacer: {
    height: 12,
  },
});
