import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { migrate } from "@/db";
import { font, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // The database file keeps its original name: renaming it would orphan every
  // existing keeper's plants.
  return (
    <SQLiteProvider databaseName="plant-passport.db" onInit={migrate}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.background },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: font.bold, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Greenhouse", headerShown: false }} />
        <Stack.Screen name="plant/new" options={{ title: "Add plant", presentation: "modal" }} />
        <Stack.Screen name="plant/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="plant/[id]/edit" options={{ title: "Edit plant", presentation: "modal" }} />
      </Stack>
    </SQLiteProvider>
  );
}
