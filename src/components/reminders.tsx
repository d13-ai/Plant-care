import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Switch, View } from "react-native";
import { Body, Button, Card, Chips, Heading, Row, SectionLabel } from "@/components/ui";
import type { PlantWithHistory } from "@/db";
import { formatReminderTime, REMINDER_TIMES } from "@/domain/reminders";
import {
  answerReminderPrompt,
  loadReminderPrefs,
  refreshReminders,
  reminderPromptAnswered,
  reminderPermission,
  remindersAvailable,
  saveReminderPrefs,
  turnRemindersOn,
  type ReminderPermission,
  type StoredReminderPrefs,
} from "@/lib/reminders";
import { subscribeSync } from "@/lib/sync";
import { cardTheme, useTheme } from "@/theme";

/**
 * Keeps the phone's reminder queue in step with the greenhouse, and opens the
 * right plant when a reminder is tapped. Renders nothing; sits inside the
 * database provider in the root layout.
 *
 * The queue is planned again when the app opens, when it goes to the
 * background (by then whatever was logged in this visit is in), and after
 * every sync, which follows every write and brings in care logged on other
 * devices. Debounced, because a burst of logging is one change.
 */
export function ReminderKeeper() {
  const db = useSQLiteContext();
  const router = useRouter();

  useEffect(() => {
    if (!remindersAvailable) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshReminders(db), 1500);
    };
    soon();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        clearTimeout(timer);
        refreshReminders(db);
      } else if (state === "active") {
        soon();
      }
    });
    const unsubscribe = subscribeSync(soon);
    return () => {
      clearTimeout(timer);
      app.remove();
      unsubscribe();
    };
  }, [db]);

  useEffect(() => {
    if (!remindersAvailable) return;
    let live = true;
    let sub: { remove: () => void } | undefined;
    (async () => {
      const N = await import("expo-notifications");
      // A reminder that comes due with the app open still shows: it is the
      // same news either way.
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      const open = (response: import("expo-notifications").NotificationResponse | null) => {
        if (!response) return;
        const plantId = response.notification.request.content.data?.plantId;
        if (typeof plantId === "number") {
          router.push({ pathname: "/plant/[id]", params: { id: String(plantId) } });
        } else {
          router.navigate("/");
        }
      };
      // The tap that launched the app, if one did.
      const launch = await N.getLastNotificationResponseAsync();
      if (!live) return;
      if (launch) {
        open(launch);
        await N.clearLastNotificationResponseAsync();
      }
      sub = N.addNotificationResponseReceivedListener(open);
    })().catch(() => {});
    return () => {
      live = false;
      sub?.remove();
    };
  }, [router]);

  return null;
}

/**
 * The greenhouse's one-time question: shown on a phone once there is a plant
 * with a schedule to remind about, until it gets an answer. The system's own
 * permission question comes only after a yes here, which is the order that
 * gets a considered answer rather than a reflexive "Don't allow".
 */
export function ReminderPrompt({ plants }: { plants: PlantWithHistory[] }) {
  const db = useSQLiteContext();
  const [show, setShow] = useState(false);
  const [time, setTime] = useState("9am");
  const [refused, setRefused] = useState(false);
  const scheduled = plants.some(({ plant }) => plant.status !== "DECEASED" && (plant.waterEveryDays ?? 0) > 0);

  // On focus, so coming back from Account after switching reminders on there
  // takes the question away.
  useFocusEffect(
    useCallback(() => {
      if (!remindersAvailable || !scheduled) return;
      let live = true;
      Promise.all([reminderPromptAnswered(), loadReminderPrefs()]).then(([answered, prefs]) => {
        if (!live) return;
        setTime(formatReminderTime(prefs.hour, prefs.minute));
        setShow(!answered && !prefs.enabled);
      });
      return () => {
        live = false;
      };
    }, [scheduled]),
  );

  if (!show) return null;

  const first = plants.find(({ plant }) => (plant.waterEveryDays ?? 0) > 0)?.plant.nickname ?? "a plant";
  return (
    <Card>
      <Heading>Want a nudge when it's time?</Heading>
      <Body muted>
        {refused
          ? "Notifications are switched off for PlantParlour in your phone's settings. You can turn them on there, then come back to Account → Reminders."
          : `PlantParlour can tell you when ${first} needs water, and when anything else falls due — at ${time}, and you can change that in Account.`}
      </Body>
      <Row>
        {refused ? null : (
          <Button
            title="Turn on reminders"
            variant="primary"
            onPress={async () => {
              const on = await turnRemindersOn(db);
              if (on) {
                await answerReminderPrompt("on");
                setShow(false);
              } else {
                setRefused(true);
                await answerReminderPrompt("later");
              }
            }}
          />
        )}
        <Button
          title={refused ? "OK" : "Not now"}
          onPress={async () => {
            await answerReminderPrompt("later");
            setShow(false);
          }}
        />
      </Row>
    </Card>
  );
}

/** Account → Reminders: on or off, which kinds, and what time. */
export function ReminderSettings() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [prefs, setPrefs] = useState<StoredReminderPrefs | null>(null);
  const [permission, setPermission] = useState<ReminderPermission>("undetermined");

  useEffect(() => {
    if (!remindersAvailable) return;
    const check = () => {
      loadReminderPrefs().then(setPrefs);
      reminderPermission().then(setPermission).catch(() => {});
    };
    check();
    // Back from the phone's settings, where notifications may have been switched on.
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => app.remove();
  }, []);

  if (!remindersAvailable) {
    return (
      <Card>
        <Heading>Reminders</Heading>
        <Body small muted>
          Reminders come through the PlantParlour app on Android. Here on the web, “Add to calendar” on a
          plant's page puts its schedule in your phone's calendar instead.
        </Body>
      </Card>
    );
  }
  if (!prefs) return null;

  const change = async (next: StoredReminderPrefs) => {
    setPrefs(next);
    await saveReminderPrefs(next);
    await refreshReminders(db);
  };
  const blocked = permission === "denied";
  const on = prefs.enabled && permission === "granted";

  const toggle = async (value: boolean) => {
    if (!value) return change({ ...prefs, enabled: false });
    const granted = await turnRemindersOn(db);
    await answerReminderPrompt(granted ? "on" : "later");
    setPermission(await reminderPermission());
    setPrefs(await loadReminderPrefs());
  };

  const track = { true: t.primary, false: t.border };
  const timeValue = `${prefs.hour}:${prefs.minute}`;

  return (
    <Card>
      <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>Reminders</Heading>
          <Body small muted>
            {on ? `On this phone, at ${formatReminderTime(prefs.hour, prefs.minute)}.` : "Off on this phone."}
          </Body>
        </View>
        <Switch accessibilityLabel="Care reminders" value={on} onValueChange={toggle} trackColor={track} disabled={blocked && !prefs.enabled} />
      </Row>
      {blocked ? (
        <>
          <Body small style={{ color: cardTheme.critical.fg }}>
            Notifications are switched off for PlantParlour in your phone's settings, so reminders can't come
            through.
          </Body>
          <Row>
            <Button title="Open phone settings" small onPress={() => Linking.openSettings().catch(() => {})} />
          </Row>
        </>
      ) : null}
      {on ? (
        <>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Body>When something falls due</Body>
              <Body small muted>“💧 Monstera needs water” on the day, with how to do it when the care guide's on the phone.</Body>
            </View>
            <Switch
              accessibilityLabel="When something falls due"
              value={prefs.dueAlerts}
              onValueChange={(v) => change({ ...prefs, dueAlerts: v })}
              trackColor={track}
            />
          </Row>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <View style={{ flex: 1 }}>
              <Body>Daily nudge for anything still waiting</Body>
              <Body small muted>One a day while care is overdue, listing every plant that wants something.</Body>
            </View>
            <Switch
              accessibilityLabel="Daily nudge for anything still waiting"
              value={prefs.overdueNudge}
              onValueChange={(v) => change({ ...prefs, overdueNudge: v })}
              trackColor={track}
            />
          </Row>
          <SectionLabel>Time</SectionLabel>
          <Chips
            options={REMINDER_TIMES.map(([h, m]) => ({ label: formatReminderTime(h, m), value: `${h}:${m}` }))}
            value={timeValue}
            onChange={(v) => {
              const [hour, minute] = v.split(":").map(Number);
              change({ ...prefs, hour, minute });
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
