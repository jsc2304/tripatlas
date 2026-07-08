/** Best-effort hint of which field matched, for display next to compact rows. */
export function matchHint(
  q: string,
  fields: Array<{ label: string; value: string | null }>,
): string | null {
  if (q.trim() === "") return null;
  const needle = q.trim().toLowerCase();
  for (const f of fields) {
    if (f.value && f.value.toLowerCase().includes(needle)) {
      return f.label;
    }
  }
  return null;
}
