import Ionicons from "@expo/vector-icons/Ionicons";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  hasActiveSession,
  isAppLogoutInProgress,
  subscribeAppLogoutChange,
  subscribeAppUserChange,
} from "@/src/appSession";
import { auth } from "@/src/firebase";

const LOGIN_ROUTE = "/";
const MAIN_ROUTE = "/(tabs)/subjects";
const PROTECTED_PATHS = new Set([
  "/subjects",
  "/todo",
  "/schedule",
  "/note",
  "/quiz",
  "/(tabs)/subjects",
  "/(tabs)/todo",
  "/(tabs)/schedule",
  "/(tabs)/note",
  "/(tabs)/quiz",
]);
const PROTECTED_SEGMENTS = new Set(["(tabs)", "subjects", "todo", "schedule", "note", "quiz", "incorrect-note", "subject-notes", "note-detail"]);

export const unstable_settings = {
  anchor: "index",
};

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts({
    ...Ionicons.font,
  });
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const segments = useSegments();
  const firstSegment = segments[0];
  const pendingRouteRef = useRef<string | null>(null);

  useEffect(() => {
    const routeByAuth = () => {
      const isInTabs = PROTECTED_SEGMENTS.has(firstSegment) || PROTECTED_PATHS.has(pathname);
      const isLoginRoute = pathname === "/";
      const isAuthenticated = hasActiveSession();
      let nextRoute: string | null = null;

      if ((isAppLogoutInProgress() || !isAuthenticated) && isInTabs) {
        nextRoute = LOGIN_ROUTE;
      } else if (isAuthenticated && isLoginRoute) {
        nextRoute = MAIN_ROUTE;
      }

      if (!nextRoute || pathname === nextRoute || pendingRouteRef.current === nextRoute) {
        return;
      }

      pendingRouteRef.current = nextRoute;
      router.replace(nextRoute);

      if (nextRoute === LOGIN_ROUTE && typeof window !== "undefined") {
        window.location.replace(LOGIN_ROUTE);
      }
    };

    pendingRouteRef.current = null;
    const timeoutId = setTimeout(routeByAuth, 0);
    const unsubscribeAuth = onAuthStateChanged(auth, routeByAuth);
    const unsubscribeAppUser = subscribeAppUserChange(routeByAuth);
    const unsubscribeLogout = subscribeAppLogoutChange(routeByAuth);

    return () => {
      clearTimeout(timeoutId);
      unsubscribeAuth();
      unsubscribeAppUser();
      unsubscribeLogout();
    };
  }, [pathname, firstSegment]);

  if (!iconFontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="quiz"
          options={{
            headerShown: true,
            title: "Quiz",
            headerStyle: { backgroundColor: '#F8FAFC' },
            headerTintColor: '#1E293B',
            headerTitleStyle: { color: '#1E293B', fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="incorrect-note"
          options={{
            headerShown: true,
            title: "오답노트",
            headerStyle: { backgroundColor: '#F8FAFC' },
            headerTintColor: '#1E293B',
            headerTitleStyle: { color: '#1E293B', fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="subject-notes"
          options={{
            headerShown: true,
            title: "과목 노트",
            headerStyle: { backgroundColor: '#F8FAFC' },
            headerTintColor: '#1E293B',
            headerTitleStyle: { color: '#1E293B', fontWeight: '600' },
          }}
        />
        <Stack.Screen name="note-detail" options={{ headerShown: false }} />
        <Stack.Screen name="kakao-auth" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
