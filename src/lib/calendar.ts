/**
 * Hand a generated .ics reminder file to the OS: a file download in the
 * browser, the native share sheet on a device (from which the user picks
 * "Add to Calendar"). The .ics itself is built by src/domain/calendar.ts.
 *
 * Dynamic imports keep react-native / expo-file-system out of the module
 * graph on the web build and out of the pure-domain unit tests.
 */
export { buildPlantIcs, tasksFromStatuses, slugify } from "@/domain/calendar";
export type { CalendarTask, CareInstructionsSource, BuildIcsOptions } from "@/domain/calendar";

/**
 * Save/share an .ics file. On web this triggers a download that phones and
 * desktops open straight into the Calendar app; on native it writes a temp
 * file and opens the share sheet.
 */
export async function saveIcs(filename: string, ics: string): Promise<void> {
  const { Platform } = await import("react-native");

  if (Platform.OS === "web") {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const { Share } = await import("react-native");
  const file = new File(Paths.cache, filename);
  try {
    file.delete();
  } catch {
    // fresh cache — nothing to remove
  }
  file.create();
  file.write(ics);
  await Share.share({ url: file.uri, title: filename });
}
