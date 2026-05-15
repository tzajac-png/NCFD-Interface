/**
 * NCFD-style run numbers: e.g. `26-2-191` → year–**station**–sequence (middle segment = station 2).
 */
export function getStationFromRunNumber(runNumber: string): string | null {
  const t = runNumber.trim();
  if (!t) return null;
  const parts = t
    .split(/-+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const mid = parts[1];
  if (!mid || !/^\d+$/.test(mid)) return null;
  return String(parseInt(mid, 10));
}
