import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";

import {
  getAppUser,
  subscribeAppUserChange,
} from "@/src/appSession";
import { auth } from "@/src/firebase";
import {
  getCurrentUserProfile,
  normalizeUserProfile,
} from "@/src/userService";

type UserProfile = {
  uid?: string;
  email?: string;
  loginId?: string;
  nickname?: string;
  photoURL?: string;
};

export default function UserHeaderRight() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const nextProfile = await getCurrentUserProfile();
        if (isMounted) {
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error("[UserHeaderRight] failed to load profile", error);
        if (isMounted) {
          setProfile(normalizeUserProfile(getAppUser()));
        }
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      loadProfile();
    });

    const handleAppUserChanged = (nextUser: UserProfile | null) => {
      setProfile(normalizeUserProfile(nextUser));
      loadProfile();
    };

    const unsubscribeAppUser = subscribeAppUserChange(handleAppUserChanged);
    loadProfile();

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeAppUser();
    };
  }, []);

  if (!profile) {
    return null;
  }

  const nickname = profile.nickname || "User";
  const loginId = profile.loginId || profile.email || profile.uid || "";
  const initial = nickname.trim().charAt(0).toUpperCase() || "U";

  return (
    <View style={styles.container}>
      {profile.photoURL ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    maxWidth: 220,
    paddingRight: 12,
  },
  avatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  textBox: {
    maxWidth: 160,
  },
  nickname: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  loginId: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 1,
  },
});
