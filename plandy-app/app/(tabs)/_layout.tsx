import { Tabs, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import UserHeaderRight from '@/components/UserHeaderRight';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '@/src/firebase';
import { getAppUser, subscribeAppUserChange } from '@/src/appSession';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const syncAuthState = () => {
      const hasSession = Boolean(auth.currentUser || getAppUser());

      setIsAuthenticated(hasSession);
      setIsCheckingAuth(false);

      if (!hasSession) {
        router.replace('/');
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, syncAuthState);
    const unsubscribeAppUser = subscribeAppUserChange(syncAuthState);

    if (getAppUser()) {
      syncAuthState();
    }

    return () => {
      unsubscribeAuth();
      unsubscribeAppUser();
    };
  }, []);

  if (isCheckingAuth || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>로그인 상태를 확인하는 중입니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <Tabs
      initialRouteName="subjects"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: true,
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
          title: '과목',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="book.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="todo"
        options={{
          title: 'TodoList',
          tabBarActiveTintColor: '#a8a8aaf4',
          tabBarInactiveTintColor: '#a0a6b0f7',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: '일정',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size ?? 28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="note"
        options={{
          title: '노트',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size ?? 28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
});
