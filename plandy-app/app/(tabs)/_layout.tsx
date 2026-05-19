import { Tabs } from 'expo-router';
import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import UserHeaderRight from '@/components/UserHeaderRight';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
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
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
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
    </Tabs>
  );
}
