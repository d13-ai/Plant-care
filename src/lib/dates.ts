/** "YYYY-MM-DD" → ISO at local midnight, or null when blank/invalid. */
export function parseDate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "3" → ISO for three days ago; blank → null (caller uses now). */
export function daysAgoIso(input: string): string | null {
  const n = Number(input.trim());
  if (!input.trim() || !Number.isFinite(n) || n < 0) return null;
  return new Date(Date.now() - Math.round(n) * 86_400_000).toISOString();
}
