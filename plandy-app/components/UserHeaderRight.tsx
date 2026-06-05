import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  beginAppLogout,
  getAppUser,
  subscribeAppUserChange,
} from "@/src/appSession";
import { logoutExternalProviders } from "@/src/authService";
import { auth } from "@/src/firebase";
import {
  getCurrentUserProfile,
  normalizeUserProfile,
} from "@/src/userService";

const LOGIN_ROUTE = "/";

type UserProfile = {
  uid?: string;
  email?: string;
  loginId?: string;
  nickname?: string;
  photoURL?: string;
};

const replaceToLogin = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.replace(LOGIN_ROUTE);
    return;
  }

  router.replace(LOGIN_ROUTE);
};

export default function UserHeaderRight() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileLoadIdRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const clearProfile = () => {
      profileLoadIdRef.current += 1;
      setProfile(null);
    };

    const loadProfile = async () => {
      const profileLoadId = profileLoadIdRef.current + 1;
      profileLoadIdRef.current = profileLoadId;

      const nextProfile = await getCurrentUserProfile().catch(() =>
        normalizeUserProfile(getAppUser())
      );

      if (isMounted && profileLoadId === profileLoadIdRef.current) {
        setProfile(nextProfile);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user && !getAppUser()) {
        clearProfile();
        return;
      }

      loadProfile();
    });

    const unsubscribeAppUser = subscribeAppUserChange((nextUser: UserProfile | null) => {
      if (!nextUser) {
        clearProfile();
        return;
      }

      profileLoadIdRef.current += 1;
      setProfile(normalizeUserProfile(nextUser));
    });

    loadProfile();

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeAppUser();
    };
  }, []);

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    profileLoadIdRef.current += 1;
    setProfile(null);

    try {
      beginAppLogout();
    } finally {
      replaceToLogin();
    }

    void logoutExternalProviders().catch(() => undefined);
  };

  if (!profile && !isLoggingOut) {
    return null;
  }

  const nickname = profile?.nickname || "User";
  const loginId = profile?.loginId || profile?.email || profile?.uid || "";
  const initial = nickname.trim().charAt(0).toUpperCase() || "U";

  return (
    <View style={styles.container}>
      {profile?.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={styles.textBox}>
        <Text style={styles.nickname} numberOfLines={1}>
          {nickname}
        </Text>
        <Text style={styles.loginId} numberOfLines={1}>
          {loginId}
        </Text>
      </View>

      <Pressable
        disabled={isLoggingOut}
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
      >
        {isLoggingOut ? (
          <ActivityIndicator size="small" color="#6B7280" />
        ) : (
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    maxWidth: 300,
    paddingRight: 12,
  },
  avatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#ff6a92",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  textBox: {
    maxWidth: 130,
  },
  nickname: {
    color: "#2B2B2B",
    fontSize: 13,
    fontWeight: "700",
  },
  loginId: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 1,
  },
  logoutButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  logoutButtonDisabled: {
    opacity: 0.65,
  },
  logoutButtonText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
});
