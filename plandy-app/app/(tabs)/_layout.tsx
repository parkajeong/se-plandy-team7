import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";

import UserHeaderRight from "@/components/UserHeaderRight";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getAppUser,
  hasActiveSession,
  isAppLogoutInProgress,
  subscribeAppLogoutChange,
  subscribeAppUserChange,
} from "@/src/appSession";
import { auth } from "@/src/firebase";

const AUTH_CHECK_TIMEOUT_MS = 2000;
const MAIN_PINK = "#ff6a92";
const INACTIVE_GRAY = "#9CA3AF";

export default function TabLayout() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const clearAuthTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const syncAuthState = () => {
      setIsAuthenticated(hasActiveSession());
      setIsCheckingAuth(false);
    };

    timeoutId = setTimeout(syncAuthState, AUTH_CHECK_TIMEOUT_MS);

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      clearAuthTimeout();
      syncAuthState();
    });

    const unsubscribeAppUser = subscribeAppUserChange(() => {
      clearAuthTimeout();
      syncAuthState();
    });

    const unsubscribeLogout = subscribeAppLogoutChange(() => {
      clearAuthTimeout();
      syncAuthState();
    });

    if (getAppUser() || isAppLogoutInProgress()) {
      clearAuthTimeout();
      syncAuthState();
    }

    return () => {
      clearAuthTimeout();
      unsubscribeAuth();
      unsubscribeAppUser();
      unsubscribeLogout();
    };
  }, []);

  if (isCheckingAuth || !isAuthenticated) {
    return null;
  }

  return (
    <Tabs
      initialRouteName="subjects"
      screenOptions={{
        tabBarActiveTintColor: MAIN_PINK,
        tabBarInactiveTintColor: INACTIVE_GRAY,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerShown: true,
        headerTitle: "",
        headerRight: () => <UserHeaderRight />,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="subjects"
        options={{
          title: "과목",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="book.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="todo"
        options={{
          title: "TodoList",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: "일정",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="note"
        options={{
          title: "노트",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="studyGroup"
        options={{
          title: "스터디",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size ?? 28} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="quiz"
        options={{
          title: "Quiz",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="help-circle-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="recommendation"
        options={{
          title: "추천",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bulb-outline" size={size ?? 28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
