import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { loginWithEmail, signUpWithEmail } from "../../src/authService";

export default function HomeScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const handleSignUp = async () => {
    try {
      await signUpWithEmail(email, password, nickname);
      Alert.alert("회원가입 성공");
    } catch (error: any) {
      Alert.alert("회원가입 실패", error.message);
    }
  };

  const handleLogin = async () => {
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
        Plandy 로그인 테스트
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

      <Button title="회원가입" onPress={handleSignUp} />
      <View style={{ height: 12 }} />
      <Button title="로그인" onPress={handleLogin} />
    </View>
  );
}