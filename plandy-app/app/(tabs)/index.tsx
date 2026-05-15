import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { loginWithEmail, signUpWithEmail } from "../../src/authService";

export default function HomeScreen() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 회원가입할 때만 사용
  const [nickname, setNickname] = useState("");

  const handleSignUp = async () => {
    if (!email || !password || !nickname) {
      Alert.alert("입력 오류", "이메일, 비밀번호, 닉네임을 모두 입력하세요.");
      return;
    }

    try {
      await signUpWithEmail(email, password, nickname);
      Alert.alert("회원가입 성공");
    } catch (error: any) {
      Alert.alert("회원가입 실패", error.message);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("입력 오류", "이메일과 비밀번호를 입력하세요.");
      return;
    }

    try {
      await loginWithEmail(email, password);
      Alert.alert("로그인 성공");
    } catch (error: any) {
      Alert.alert("로그인 실패", error.message);
    }
  };

  return (
    <View style={{ padding: 24, marginTop: 60 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        {isSignUpMode ? "회원가입" : "로그인"}
      </Text>

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

      <TextInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          padding: 12,
          marginBottom: 12,
          borderRadius: 8,
        }}
      />

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

      <View style={{ height: 12 }} />

      <Button
        title={isSignUpMode ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}
        onPress={() => setIsSignUpMode(!isSignUpMode)}
      />
    </View>
  );
}