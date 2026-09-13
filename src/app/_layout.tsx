import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { migrate } from "@/db";
import { useTheme } from "@/theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <SQLiteProvider databaseName="plant-passport.db" onInit={migrate}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.background },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "My Greenhouse" }} />
        <Stack.Screen name="plant/new" options={{ title: "Add plant", presentation: "modal" }} />
        <Stack.Screen name="plant/[id]/index" options={{ title: "" }} />
        <Stack.Screen name="plant/[id]/edit" options={{ title: "Edit plant", presentation: "modal" }} />
      </Stack>
    </SQLiteProvider>
  );
}
