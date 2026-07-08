/**
 * Binärsuche nach dem Sample, dessen Zeitstempel `ts` am nächsten liegt.
 * `sortedTs` muss aufsteigend sortiert sein (epoch ms). Liefert den Index des
 * nächstgelegenen Eintrags, sofern dessen Abstand ≤ `toleranceMs` ist, sonst -1.
 * Gemeinsamer Helfer für alle Nearest-Lookups im Tessie-Import (SoC-, Batterie-,
 * Klima- und GPS-Serien).
 */
export function lookupNearest(
  sortedTs: number[],
  ts: number,
  toleranceMs: number,
): number {
  const n = sortedTs.length;
  if (n === 0) return -1;

  // Erste Position finden, an der sortedTs[idx] >= ts (lower bound).
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedTs[mid]! < ts) lo = mid + 1;
    else hi = mid;
  }

  // Der nächste Nachbar ist entweder lo (erstes >= ts) oder lo-1 (letztes < ts).
  let best = -1;
  let bestDiff = Infinity;
  for (const idx of [lo - 1, lo]) {
    if (idx < 0 || idx >= n) continue;
    const diff = Math.abs(sortedTs[idx]! - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = idx;
    }
  }

  return bestDiff <= toleranceMs ? best : -1;
}
