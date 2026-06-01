import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  authenticateWithPasswordForWithdraw,
  clearLocalSession,
  getWithdrawAccountErrorMessage,
  withdrawExternalAppAccount,
  withdrawFirebaseAuthAccount,
} from "../src/accountService";
import {
  loginWithGoogle,
  loginWithIdOrEmail,
  loginWithKakao,
  signInWithGoogleOnly,
  signInWithKakaoOnly,
  signUpWithEmail,
} from "../src/authService";
import { beginAppLogout } from "../src/appSession";

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
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [withdrawIdOrEmail, setWithdrawIdOrEmail] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawProvider, setWithdrawProvider] = useState<
    "password" | "google" | "kakao" | null
  >(null);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
      return;
    }

    Alert.alert(title, message);
  };

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

  const openWithdrawModal = () => {
    setWithdrawIdOrEmail("");
    setWithdrawPassword("");
    setIsWithdrawModalVisible(true);
  };

  const handleOpenWithdrawAccount = () => {
    const message =
      "회원 탈퇴를 위해 계정 인증이 필요합니다.\n탈퇴 시 계정 정보와 관련 데이터가 삭제되며 복구가 어려울 수 있습니다.";

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(message)) {
        openWithdrawModal();
      }
      return;
    }

    Alert.alert("회원 탈퇴", message, [
      { text: "취소", style: "cancel" },
      {
        text: "계정 인증",
        style: "destructive",
        onPress: openWithdrawModal,
      },
    ]);
  };

  const confirmWithdraw = (onConfirm: () => Promise<void>) => {
    const message =
      "회원 탈퇴 시 계정 정보와 관련 데이터가 삭제되며 복구가 어려울 수 있습니다. 정말 탈퇴하시겠습니까?";

    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.confirm(message) ? onConfirm() : Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      Alert.alert("회원 탈퇴", message, [
        {
          text: "취소",
          style: "cancel",
          onPress: resolve,
        },
        {
          text: "탈퇴 진행",
          style: "destructive",
          onPress: () => {
            void onConfirm().finally(resolve);
          },
        },
      ]);
    });
  };

  const resetWithdrawState = () => {
    setIsWithdrawModalVisible(false);
    setWithdrawIdOrEmail("");
    setWithdrawPassword("");
    setPassword("");
  };

  const handleWithdrawWithPassword = async () => {
    if (isWithdrawing) {
      return;
    }

    if (!withdrawIdOrEmail.trim() || !withdrawPassword) {
      showAlert("입력 오류", "아이디 또는 이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      setIsWithdrawing(true);
      setWithdrawProvider("password");
      const user = await authenticateWithPasswordForWithdraw({
        idOrEmail: withdrawIdOrEmail,
        password: withdrawPassword,
      });

      await confirmWithdraw(async () => {
        try {
          await withdrawFirebaseAuthAccount(user);

          resetWithdrawState();
          showAlert("회원 탈퇴 완료", "회원 탈퇴가 완료되었습니다.");
        } catch (error: any) {
          console.log("[HomeScreen] account withdrawal failed", error);
          showAlert("회원 탈퇴 실패", getWithdrawAccountErrorMessage(error));
        }
      });
    } catch (error: any) {
      console.log("[HomeScreen] password withdrawal authentication failed", error);
      showAlert("회원 탈퇴 실패", getWithdrawAccountErrorMessage(error));
    } finally {
      await clearLocalSession();
      setIsWithdrawing(false);
      setWithdrawProvider(null);
    }
  };

  const handleWithdrawWithGoogle = async () => {
    if (isWithdrawing) {
      return;
    }

    try {
      setIsWithdrawing(true);
      setWithdrawProvider("google");
      let googleUser;

      try {
        beginAppLogout();
        googleUser = await signInWithGoogleOnly({ cancelLogout: false });
      } catch (error) {
        console.log("[HomeScreen] Google withdrawal authentication failed", error);
        showAlert("회원 탈퇴 실패", "Google 인증에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      await confirmWithdraw(async () => {
        try {
          await withdrawFirebaseAuthAccount(googleUser);
          resetWithdrawState();
          showAlert("회원 탈퇴 완료", "회원 탈퇴가 완료되었습니다.");
        } catch (error: any) {
          console.log("[HomeScreen] Google account withdrawal failed", error);
          showAlert("회원 탈퇴 실패", getWithdrawAccountErrorMessage(error));
        }
      });
    } finally {
      await clearLocalSession();
      setIsWithdrawing(false);
      setWithdrawProvider(null);
    }
  };

  const handleWithdrawWithKakao = async () => {
    if (isWithdrawing || kakaoLoginInProgressRef.current) {
      return;
    }

    try {
      setIsWithdrawing(true);
      setWithdrawProvider("kakao");
      kakaoLoginInProgressRef.current = true;
      let kakaoUser;

      try {
        beginAppLogout();
        kakaoUser = await signInWithKakaoOnly({
          cancelLogout: false,
          persistAppUser: false,
        });
      } catch (error) {
        console.log("[HomeScreen] Kakao withdrawal authentication failed", error);
        showAlert("회원 탈퇴 실패", "카카오 인증에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      await confirmWithdraw(async () => {
        try {
          await withdrawExternalAppAccount(kakaoUser);
          resetWithdrawState();
          showAlert("회원 탈퇴 완료", "회원 탈퇴가 완료되었습니다.");
        } catch (error: any) {
          console.log("[HomeScreen] Kakao account withdrawal failed", error);
          showAlert("회원 탈퇴 실패", getWithdrawAccountErrorMessage(error));
        }
      });
    } finally {
      kakaoLoginInProgressRef.current = false;
      await clearLocalSession();
      setIsWithdrawing(false);
      setWithdrawProvider(null);
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

      {!isSignUpMode && (
        <>
          <View style={styles.spacer} />
          <Pressable
            style={styles.withdrawOpenButton}
            onPress={handleOpenWithdrawAccount}
          >
            <Text style={styles.withdrawOpenButtonText}>회원 탈퇴</Text>
          </Pressable>
        </>
      )}

      <Modal
        visible={isWithdrawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isWithdrawing) {
            setIsWithdrawModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.withdrawModal}>
            <Text style={styles.withdrawTitle}>회원 탈퇴</Text>
            <Text style={styles.withdrawDescription}>
              이메일/비밀번호 계정은 아이디 또는 이메일과 비밀번호를 입력해주세요. Google/Kakao 계정은 아래 버튼으로 다시 인증 후 탈퇴할 수 있습니다.
            </Text>

            <TextInput
              placeholder="아이디 또는 이메일"
              value={withdrawIdOrEmail}
              onChangeText={setWithdrawIdOrEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isWithdrawing}
              style={styles.input}
            />

            <TextInput
              placeholder="비밀번호"
              value={withdrawPassword}
              onChangeText={setWithdrawPassword}
              secureTextEntry
              editable={!isWithdrawing}
              style={styles.input}
            />

            <Pressable
              disabled={isWithdrawing}
              style={[
                styles.withdrawConfirmButton,
                isWithdrawing && styles.disabledButton,
              ]}
              onPress={handleWithdrawWithPassword}
            >
              {isWithdrawing && withdrawProvider === "password" ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.withdrawConfirmButtonText}>탈퇴 진행</Text>
              )}
            </Pressable>

            <Pressable
              disabled={isWithdrawing}
              style={[styles.withdrawProviderButton, isWithdrawing && styles.disabledButton]}
              onPress={handleWithdrawWithGoogle}
            >
              {isWithdrawing && withdrawProvider === "google" ? (
                <ActivityIndicator size="small" color="#374151" />
              ) : (
                <Text style={styles.withdrawProviderButtonText}>
                  Google 계정으로 탈퇴
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={isWithdrawing}
              style={[styles.withdrawProviderButton, isWithdrawing && styles.disabledButton]}
              onPress={handleWithdrawWithKakao}
            >
              {isWithdrawing && withdrawProvider === "kakao" ? (
                <ActivityIndicator size="small" color="#374151" />
              ) : (
                <Text style={styles.withdrawProviderButtonText}>
                  카카오 계정으로 탈퇴
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={isWithdrawing}
              style={[styles.withdrawCancelButton, isWithdrawing && styles.disabledButton]}
              onPress={() => setIsWithdrawModalVisible(false)}
            >
              <Text style={styles.withdrawCancelButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  withdrawOpenButton: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  withdrawOpenButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  modalBackground: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  withdrawModal: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  withdrawTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  withdrawDescription: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  withdrawConfirmButton: {
    alignItems: "center",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    marginTop: 4,
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
  },
  withdrawConfirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  withdrawProviderButton: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginTop: 10,
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
  },
  withdrawProviderButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  withdrawCancelButton: {
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  withdrawCancelButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.65,
  },
});
