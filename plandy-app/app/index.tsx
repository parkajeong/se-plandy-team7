import { router } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  loginWithGoogle,
  loginWithIdOrEmail,
  loginWithKakao,
  signUpWithEmail,
} from "../src/authService";
import {
  beginAccountDeletionAuth,
  beginAppLogout,
  finishAccountDeletionAuth,
} from "../src/appSession";
import { app } from "../src/firebase";
import { COLORS } from "@/constants/theme";

const MAIN_ROUTE = "/(tabs)/subjects";
const DANGER_RED = "#EF4444";

export default function HomeScreen() {
  const [authMode, setAuthMode] = useState<"login" | "delete">("login");
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isKakaoLoginLoading, setIsKakaoLoginLoading] = useState(false);
  const kakaoLoginInProgressRef = useRef(false);
  const accountDeletionInProgressRef = useRef(false);

  const [idOrEmail, setIdOrEmail] = useState("");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const isDeleteMode = authMode === "delete";

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(message);
      return;
    }

    Alert.alert(title, message);
  };

  const handleSignUp = async () => {
    if (isDeletingAccount) {
      return;
    }

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
      console.error("회원가입 실패 상세:", error);
      Alert.alert("회원가입 실패", error.message);
    }
  };

  const handleDeleteAfterAuth = async (authenticatedUser: any) => {
    if (accountDeletionInProgressRef.current) {
      return false;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;

    console.log(
      "[deleteAccount] current user:",
      user?.uid || authenticatedUser?.uid
    );

    if (!user) {
      showAlert(
        "회원 탈퇴 인증",
        "계정 탈퇴를 위해 다시 로그인해 주세요."
      );
      return false;
    }

    try {
      const functions = getFunctions(app, "us-central1");
      const callable = httpsCallable(functions, "deleteCurrentAccount");

      accountDeletionInProgressRef.current = true;
      setIsDeletingAccount(true);
      console.log("[deleteAccount] callable start");
      const result = await callable();
      console.log("[deleteAccount] callable success:", result.data);

      try {
        await signOut(auth);
      } catch (signOutError) {
        console.warn("[deleteAccount] signOut failed:", signOutError);
      }

      beginAppLogout();
      finishAccountDeletionAuth();
      setAuthMode("login");
      setIdOrEmail("");
      setPassword("");
      router.replace("/");
      showAlert("회원 탈퇴 완료", "회원 탈퇴가 완료되었습니다.");
      return true;
    } catch (error: any) {
      console.error("[deleteAccount] failed:", error);
      const errorCode = error?.code || "unknown";
      const errorMessage = error?.message || String(error);
      showAlert(
        "회원 탈퇴 실패",
        `code: ${errorCode}\nmessage: ${errorMessage}`
      );
      return false;
    } finally {
      accountDeletionInProgressRef.current = false;
      setIsDeletingAccount(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isDeletingAccount) {
      return;
    }

    try {
      const user = await loginWithGoogle();

      if (isDeleteMode) {
        await handleDeleteAfterAuth(user);
        return;
      }
      Alert.alert("Google 로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      Alert.alert("Google 로그인 실패", error.message);
    }
  };

  const handleKakaoLogin = async () => {
    if (isDeletingAccount || kakaoLoginInProgressRef.current) {
      return;
    }

    try {
      kakaoLoginInProgressRef.current = true;
      setIsKakaoLoginLoading(true);
      const user = await loginWithKakao();

      if (isDeleteMode) {
        await handleDeleteAfterAuth(user);
        return;
      }
      Alert.alert("카카오 로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      console.error("카카오 로그인 실패 상세:", error);
      Alert.alert("카카오 로그인 실패", error.message);
    } finally {
      kakaoLoginInProgressRef.current = false;
      setIsKakaoLoginLoading(false);
    }
  };

  const handleLogin = async () => {
    if (isDeletingAccount) {
      return;
    }

    if (!idOrEmail || !password) {
      Alert.alert("입력 오류", "아이디 또는 이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      const user = await loginWithIdOrEmail(idOrEmail, password);

      if (isDeleteMode) {
        await handleDeleteAfterAuth(user);
        return;
      }
      Alert.alert("로그인 성공");
      router.replace(MAIN_ROUTE);
    } catch (error: any) {
      Alert.alert("로그인 실패", error.message);
    }
  };

  const handleDeleteMode = () => {
    if (isDeletingAccount) {
      return;
    }

    const nextMode = isDeleteMode ? "login" : "delete";

    setAuthMode(nextMode);
    setIsSignUpMode(false);
    setPassword("");

    if (nextMode === "delete") {
      beginAccountDeletionAuth();
      console.log("[deleteAccount] mode enabled");
    } else {
      finishAccountDeletionAuth();
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.formContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.authPanel}>
      <Text style={styles.title}>
        {isSignUpMode
          ? "회원가입"
          : isDeleteMode
            ? "회원 탈퇴 인증"
            : "로그인"}
      </Text>

      {isSignUpMode ? (
        <>
          <TextInput
            placeholder="아이디"
            placeholderTextColor="#9CA3AF"
            value={loginId}
            onChangeText={setLoginId}
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            placeholder="이메일"
            placeholderTextColor="#9CA3AF"
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
          placeholderTextColor="#9CA3AF"
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
          placeholderTextColor="#9CA3AF"
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
          placeholderTextColor="#9CA3AF"
          value={nickname}
          onChangeText={setNickname}
          style={styles.input}
        />
      )}

      {isSignUpMode ? (
        <Pressable
          disabled={isDeletingAccount}
          style={[
            styles.primaryButton,
            isDeletingAccount && styles.disabledButton,
          ]}
          onPress={handleSignUp}
        >
          <Text style={styles.primaryButtonText}>회원가입</Text>
        </Pressable>
      ) : (
        <Pressable
          disabled={isDeletingAccount}
          style={[
            styles.primaryButton,
            isDeletingAccount && styles.disabledButton,
          ]}
          onPress={handleLogin}
        >
          <Text style={styles.primaryButtonText}>
            {isDeleteMode ? "인증 후 탈퇴" : "로그인"}
          </Text>
        </Pressable>
      )}

      {!isSignUpMode && (
        <>
          <View style={styles.divider} />
          <View style={styles.buttonGrid}>
            <Pressable
              disabled={isDeletingAccount}
              style={[
                styles.gridPrimaryButton,
                isDeletingAccount && styles.disabledButton,
              ]}
              onPress={handleGoogleLogin}
            >
              <Text style={styles.primaryButtonText}>
                {isDeleteMode ? "Google 인증 후 탈퇴" : "Google로 로그인"}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.gridPrimaryButton,
                (isKakaoLoginLoading || isDeletingAccount) &&
                  styles.disabledButton,
              ]}
              onPress={handleKakaoLogin}
              disabled={isKakaoLoginLoading || isDeletingAccount}
            >
              <Text style={styles.primaryButtonText}>
                {isKakaoLoginLoading
                  ? "카카오 로그인 중..."
                  : isDeleteMode
                    ? "카카오 인증 후 탈퇴"
                    : "카카오로 로그인"}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={styles.buttonGrid}>
        <Pressable
          disabled={isDeletingAccount}
          style={[
            styles.gridSecondaryButton,
            isDeletingAccount && styles.disabledButton,
          ]}
          onPress={() => {
            setIsSignUpMode(!isSignUpMode);
            setAuthMode("login");
            finishAccountDeletionAuth();
            setPassword("");
          }}
        >
          <Text style={styles.secondaryButtonText}>
            {isSignUpMode ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}
          </Text>
        </Pressable>

        {!isSignUpMode && (
          <Pressable
            disabled={isDeletingAccount}
            style={[
              styles.gridSecondaryButton,
              isDeletingAccount && styles.disabledButton,
            ]}
            onPress={handleDeleteMode}
          >
            <Text style={styles.secondaryButtonText}>
              {isDeleteMode ? "탈퇴 인증 취소" : "회원 탈퇴"}
            </Text>
          </Pressable>
        )}
      </View>
      </View>

      <Modal
        visible={isDeletingAccount}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.deletingOverlay}>
          <View style={styles.deletingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.deletingTitle}>회원 탈퇴 중입니다</Text>
            <Text style={styles.deletingDescription}>
              계정과 학습 데이터를 삭제하고 있습니다. 잠시만 기다려주세요.
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F8FA",
  },
  formContainer: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  authPanel: {
    width: "100%",
    maxWidth: 520,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    color: "#2B2B2B",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    padding: 12,
    color: "#2B2B2B",
  },
  passwordBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    color: "#2B2B2B",
  },
  passwordToggle: {
    color: DANGER_RED,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  divider: {
    backgroundColor: "#E5E7EB",
    height: 1,
    marginVertical: 18,
    width: "100%",
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  gridPrimaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 130,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  gridSecondaryButton: {
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 130,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#2B2B2B",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
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
    color: "#2B2B2B",
  },
  withdrawDescription: {
    color: "#6B7280",
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
    color: "#6B7280",
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
    color: "#2B2B2B",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.65,
  },
  deletingOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  deletingCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    maxWidth: 420,
    paddingHorizontal: 28,
    paddingVertical: 32,
    width: "100%",
  },
  deletingTitle: {
    color: "#2B2B2B",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center",
  },
  deletingDescription: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
  },
});
