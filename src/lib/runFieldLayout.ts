import type { SheetRow } from "../types";
import { getStationFromRunNumber } from "./runNumber";

/** Normalize header for matching spreadsheet columns */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCell(row: SheetRow, headers: string[], candidates: string[]): string {
  const map = new Map(headers.map((x) => [normalizeHeader(x), x]));
  for (const c of candidates) {
    const key = normalizeHeader(c);
    const actual = map.get(key);
    if (actual != null) {
      const v = row[actual] ?? "";
      if (v.trim() !== "") return v.trim();
    }
  }
  for (const h of headers) {
    if (normalizeHeader(h) === normalizeHeader(candidates[0] ?? "")) {
      return (row[h] ?? "").trim();
    }
  }
  return "";
}

/**
 * Sheet "Report Type" / primary-supplemental cells sometimes contain the list title
 * ("Primary or Supplemental") instead of a single choice — treat as empty so the UI
 * does not show that string as the report label.
 */
function normalizePrimarySupplementalValue(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return "";
  if (
    t === "primary or supplemental" ||
    t === "primary / supplemental" ||
    t === "primary/supplemental" ||
    t === "primary supplemental"
  ) {
    return "";
  }
  return raw.trim();
}

/** Street / intersection line for map + list (matches common CAD export headers). */
const LOCATION_ADDRESS_CANDIDATES = [
  "Location Address",
  "location address",
  "Address",
  "address",
  "Incident Address",
  "incident address",
  "Street Address",
  "street address",
  "Location",
  "location",
  "Incident Location",
  "incident location",
  "Full Address",
  "full address",
  "Run Location",
  "run location",
  "Scene Address",
  "scene address",
];

const CITY_CANDIDATES = [
  "City",
  "city",
  "City of Incident",
  "city of incident",
  "Incident City",
  "incident city",
  "City/Town",
  "city/town",
  "Municipality",
  "municipality",
];

export interface MapAddressParts {
  /** Street / intersection / place line (not city name alone). */
  address: string;
  city: string;
  zip: string;
  /** Single line for geocoders: address, city, ZIP, MI, USA */
  fullQuery: string;
}

/**
 * Reads location from the row: **address** (street / location field) and **city** separately,
 * then builds a consistent geocode string.
 */
/** Normalize city for map/search (NCFD is Northville / Plymouth only). */
export function normalizeNcfdCity(cityRaw: string): string {
  let s = cityRaw.trim();
  if (!s) return "";
  s = s.replace(/^city\s+of\s+/i, "").trim();
  const lower = s.toLowerCase();
  if (lower.includes("northville")) return "Northville";
  if (lower.includes("plymouth")) return "Plymouth";
  return s;
}

export function getMapAddressParts(row: SheetRow, headers: string[]): MapAddressParts {
  const address = findCell(row, headers, LOCATION_ADDRESS_CANDIDATES);
  const city = normalizeNcfdCity(findCell(row, headers, CITY_CANDIDATES));
  const zip = findCell(row, headers, ["Zip", "zip", "ZIP", "Postal Code", "postal code", "Zip Code", "zip code"]);

  const parts: string[] = [];
  if (address) parts.push(address);
  if (city && (!address || !address.toLowerCase().includes(city.toLowerCase()))) {
    parts.push(city);
  } else if (!address && city) {
    parts.push(city);
  }

  let line = parts.join(", ").trim();
  if (zip && line && !line.includes(zip)) {
    line = `${line} ${zip}`.trim();
  }

  let fullQuery = line;
  if (fullQuery) {
    const lower = fullQuery.toLowerCase();
    if (!/\b(mi|michigan)\b/.test(lower)) fullQuery = `${fullQuery}, MI`;
    if (!/\b(us|usa|united states)\b/.test(lower)) fullQuery = `${fullQuery}, USA`;
  }

  return { address, city, zip, fullQuery };
}

/** @deprecated Use getMapAddressParts().fullQuery — kept for any external imports */
export function buildMapSearchQuery(row: SheetRow, headers: string[]): string {
  return getMapAddressParts(row, headers).fullQuery;
}

const RUN_NUMBER_CANDIDATES = [
  "Run Number",
  "run number",
  "Incident #",
  "Incident Number",
  "incident #",
  "incident number",
  "CAD #",
  "cad #",
  "Call Number",
  "call number",
];

export interface CallListSummary {
  runNumber: string;
  date: string;
  time: string;
  type: string;
  status: string;
  /** Responding station label (from run # middle segment when present, else sheet column). */
  station: string;
  /** Normalized station key for filters, e.g. "1", "2". */
  stationKey: string | null;
  /** Sheet value for Primary / Supplemental (or similar). */
  primarySupplemental: string;
  locationAddress: string;
  city: string;
  /** Display: "address · city" */
  locationLine: string;
}

export function getCallListSummary(
  row: SheetRow,
  headers: string[],
  opts: { statusHeader: string | null; stationHeader: string | null },
): CallListSummary {
  const runNumber = findCell(row, headers, RUN_NUMBER_CANDIDATES);
  const date = findCell(row, headers, ["Date", "date", "Incident Date", "incident date", "Run Date", "run date"]);
  const time = findCell(row, headers, ["Time", "time", "Call Time", "call time", "Dispatch Time", "dispatch time"]);
  const type = findCell(row, headers, [
    "Run Type",
    "run type",
    "Type",
    "type",
    "Incident Type",
    "incident type",
    "Call Type",
    "call type",
    "Response Type",
    "response type",
  ]);
  const status = opts.statusHeader
    ? (row[opts.statusHeader] ?? "").trim()
    : findCell(row, headers, ["Status", "status", "Disposition", "disposition"]);
  const primarySupplemental = normalizePrimarySupplementalValue(
    findCell(row, headers, [
      "Report Type",
      "report type",
      "Primary / Supplemental",
      "primary / supplemental",
      "Primary Supplemental",
      "primary supplemental",
      "Primary or Supplemental",
      "primary or supplemental",
      "Prim/Supp",
      "prim/supp",
      "Run Category",
      "run category",
      "Call Category",
      "call category",
    ]),
  );

  const stationKey = getEffectiveStationKey(row, headers, opts.stationHeader);
  const station = stationKey ? formatStationTabLabel(stationKey) : "";

  const { address, city } = getMapAddressParts(row, headers);
  const locationLine = [address, city].filter(Boolean).join(" · ") || "";

  return {
    runNumber,
    date,
    time,
    type,
    status,
    station,
    stationKey,
    primarySupplemental,
    locationAddress: address,
    city,
    locationLine,
  };
}

/** Normalize station labels for tab keys: "Station 2", "2", "02" → "2". */
export function normalizeStationKey(raw: string): string {
  const s = raw.trim();
  const m = s.match(/(\d+)/);
  if (m) return String(parseInt(m[1], 10));
  return s.toLowerCase();
}

/**
 * Station for filters/display: **middle segment of run number** (e.g. 26-2-191 → station 2) when parseable,
 * otherwise the station column (or fallback station field).
 */
export function getEffectiveStationKey(
  row: SheetRow,
  headers: string[],
  stationHeader: string | null,
): string | null {
  const runNum = findCell(row, headers, RUN_NUMBER_CANDIDATES);
  const fromRun = runNum ? getStationFromRunNumber(runNum) : null;
  if (fromRun) return fromRun;
  if (stationHeader) {
    const c = (row[stationHeader] ?? "").trim();
    if (c) return normalizeStationKey(c);
  }
  const fallback = findCell(row, headers, ["Station", "station", "Responding station", "responding station"]);
  return fallback ? normalizeStationKey(fallback) : null;
}

/** Distinct station keys across rows (run # middle segment preferred). */
export function getDistinctStationKeys(rows: SheetRow[], headers: string[], stationHeader: string | null): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const k = getEffectiveStationKey(row, headers, stationHeader);
    if (k) set.add(k);
  }
  return [...set].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && String(na) === a && String(nb) === b) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

function parseUsDateTimeToMs(dateStr: string, timeStr: string): number {
  const d = dateStr.trim();
  if (!d) return 0;

  const slash = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const month = parseInt(slash[1], 10);
    const day = parseInt(slash[2], 10);
    const year = parseInt(slash[3], 10);
    let hh = 12;
    let mm = 0;
    let ss = 0;
    const t = timeStr.trim();
    const ampm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (ampm) {
      hh = parseInt(ampm[1], 10);
      mm = parseInt(ampm[2], 10);
      ss = ampm[3] ? parseInt(ampm[3], 10) : 0;
      const ap = ampm[4]?.toUpperCase();
      if (ap === "PM" && hh < 12) hh += 12;
      if (ap === "AM" && hh === 12) hh = 0;
    } else {
      const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (tm) {
        hh = parseInt(tm[1], 10);
        mm = parseInt(tm[2], 10);
        ss = tm[3] ? parseInt(tm[3], 10) : 0;
      }
    }
    return new Date(year, month - 1, day, hh, mm, ss).getTime();
  }

  const iso = Date.parse(d + (timeStr.trim() ? `T${timeStr.trim()}` : ""));
  if (!Number.isNaN(iso)) return iso;
  return 0;
}

/** Newest-first sort key (ms). Missing/invalid dates sort last. */
export function getRowSortTimestampMs(row: SheetRow, headers: string[]): number {
  const date = findCell(row, headers, ["Date", "date", "Incident Date", "incident date", "Run Date", "run date"]);
  const time = findCell(row, headers, ["Time", "time", "Call Time", "call time", "Dispatch Time", "dispatch time"]);
  const ms = parseUsDateTimeToMs(date, time);
  return ms;
}

/** Column that holds responding station (for filters / tabs). */
export function findStationColumn(headers: string[]): string | null {
  const pairs = headers.map((h) => ({ h, n: normalizeHeader(h) }));
  const skip = (n: string) =>
    /personnel|tasks|officer|staffing|holiday|email|primary station|secondary station/i.test(n);

  const exact = pairs.find((p) => p.n === "station");
  if (exact && !skip(exact.n)) return exact.h;

  const loose = pairs.filter(
    (p) => (p.n.startsWith("station") || /\bstation\b/.test(p.n)) && !skip(p.n),
  );
  loose.sort((a, b) => a.n.length - b.n.length);
  return loose[0]?.h ?? null;
}

/** Tab label: "1" → "Station 1"; leave full strings as-is. */
export function formatStationTabLabel(value: string): string {
  const t = value.trim();
  if (!t) return t;
  if (/^\d+$/.test(t)) return `Station ${t}`;
  const m = t.match(/^sta\.?\s*(\d+)$/i);
  if (m) return `Station ${m[1]}`;
  return t;
}

export type RunGroupId =
  | "overview"
  | "timeline"
  | "metrics"
  | "response"
  | "scene"
  | "apparatus"
  | "personnel"
  | "medical"
  | "admin"
  | "notes"
  | "other";

const GROUP_LABELS: Record<RunGroupId, string> = {
  overview: "Run overview",
  timeline: "Timeline & status",
  metrics: "Response times & units",
  response: "Response & patient",
  scene: "Scene & agencies",
  apparatus: "Apparatus & assignments",
  personnel: "Personnel & hours",
  medical: "Medical / EMS details",
  admin: "Administrative",
  notes: "Notes & narrative",
  other: "Additional fields",
};

export const RUN_GROUP_ORDER: RunGroupId[] = [
  "overview",
  "timeline",
  "metrics",
  "response",
  "scene",
  "apparatus",
  "personnel",
  "medical",
  "admin",
  "notes",
];

/** Priority order for hero summary strip (normalized keys) */
const OVERVIEW_PRIORITY: string[] = [
  "run number",
  "date",
  "primary / supplemental",
  "primary supplemental",
  "primary or supplemental",
  "report type",
  "address",
  "city",
  "station",
  "city of incident",
  "call dispatched",
  "run type",
  "response type",
  "incident command",
  "incident type (all)",
  "incident type (medical)",
  "call received",
  "incident category",
];

function isApparatusColumn(h: string): boolean {
  const s = h.trim();
  if (/^(r|u|e|a)\d{4}\s/i.test(s)) return true;
  if (/^r3\s/i.test(s)) return true;
  if (/additional trucks on air|additional trucks on scene/i.test(s)) return true;
  if (/^03 |^07 |^11 |^21 |^22 |^23 |^27 |^31 |^41 |^43 |^51 |^61 /i.test(s)) return true;
  if (/^u1707|^u1727|^e1711|^e1721|^e1731|^e1741|^e1751|^e1761|^a1722|^r1703|^r1723|^r1743/i.test(s)) return true;
  if (/truck checks completed|apparatus on air|pov\b/i.test(s)) return true;
  return false;
}

function isPersonnelHours(h: string): boolean {
  return /\bhours\s*\[/i.test(h) || /^hours\s*\[/i.test(h.trim());
}

function isMedicalField(h: string): boolean {
  const n = normalizeHeader(h);
  if (/arrival at hospital|en route to hospital|ambulance arrival/i.test(n)) return false;
  if (/^call received$|^clear$|^en route$|^arrival$|^in quarters$|^in service$/i.test(n.trim())) return false;
  return (
    /cpr|aed|cardiac|arrest|rosc|airway|pulse|colorimetric|defibrill|witnessed|pcr|patient expire|attach cad/i.test(n) ||
    /apparent cause|incident specifics|ems provider/i.test(n)
  );
}

/** Columns to hide everywhere on the run detail screen. */
function isExcludedDetailField(header: string): boolean {
  return normalizeHeader(header) === "date time";
}

function categorize(header: string): RunGroupId {
  const n = normalizeHeader(header);

  if (isApparatusColumn(header)) return "apparatus";
  if (isPersonnelHours(header)) return "personnel";

  if (
    [
      "primary / supplemental",
      "primary supplemental",
      "primary or supplemental",
      "prim/supp",
      "report type",
      "run category",
      "call category",
    ].includes(n)
  ) {
    return "overview";
  }

  if (
    [
      "run number",
      "date",
      "address",
      "city",
      "station",
      "city of incident",
      "call dispatched",
      "response report completed by",
      "run type",
      "response type",
      "incident command",
      "incident type (all)",
      "incident type (medical)",
      "report type",
      "report completed by",
      "incident category",
      "staffing",
      "officer",
      "primary station personnel",
      "secondary station personnel",
      "total personnel",
      "multiple runs",
      "check box if it applies",
      "officer / senior member",
      "station tasks completed",
      "holiday pay",
    ].includes(n)
  ) {
    return "overview";
  }

  if (n === "hours" && !isPersonnelHours(header)) return "metrics";
  if (n === "email address") return "admin";

  if (
    [
      "call received",
      "en route",
      "arrival",
      "ambulance arrival",
      "en route to hospital",
      "arrival at hospital",
      "clear",
      "in quarters",
      "in service",
      "ambulance cancelled time",
    ].includes(n) ||
    (n.includes("en route") && !isApparatusColumn(header)) ||
    (n.includes("arrival") && !isApparatusColumn(header))
  ) {
    if (isApparatusColumn(header)) return "apparatus";
    return "timeline";
  }

  if (["als disposition", "patient transport", "aid given or received"].includes(n)) {
    return "response";
  }

  if (
    [
      "fd response time",
      "als response time",
      "senior medical",
      "ambulance unit #",
      "ambulance response location",
    ].includes(n)
  ) {
    return "metrics";
  }

  if (
    [
      "n'ville pd on scene",
      "ply pd on scene",
      "city of incident",
    ].includes(n) ||
    /pd on scene/i.test(n)
  ) {
    return "scene";
  }

  if (
    n.includes("notes") ||
    n.includes("narrative") ||
    n === "incident specifics"
  ) {
    return "notes";
  }

  if (isMedicalField(header)) return "medical";

  if (
    /email|checkbox|holiday|report completed|pcr was left|truck checks completed(?!.*air)/i.test(n)
  ) {
    return "admin";
  }

  return "other";
}

export function groupRunFields(headers: string[]): Map<string, RunGroupId> {
  const m = new Map<string, RunGroupId>();
  for (const h of headers) {
    m.set(h, categorize(h));
  }
  return m;
}

export function getGroupLabel(id: RunGroupId): string {
  return GROUP_LABELS[id];
}

export interface FieldEntry {
  header: string;
  value: string;
}

/** Overview strip: important fields first, then other overview fields with values */
export function getOverviewStrip(
  row: SheetRow,
  headers: string[],
  groupMap: Map<string, RunGroupId>,
): FieldEntry[] {
  const normToHeader = new Map(headers.map((h) => [normalizeHeader(h), h]));
  const used = new Set<string>();
  const out: FieldEntry[] = [];

  for (const key of OVERVIEW_PRIORITY) {
    const h = normToHeader.get(key);
    if (!h || isExcludedDetailField(h)) continue;
    const v = (row[h] ?? "").trim();
    if (!v) continue;
    out.push({ header: h, value: v });
    used.add(h);
  }

  for (const h of headers) {
    if (used.has(h) || isExcludedDetailField(h)) continue;
    if (groupMap.get(h) !== "overview") continue;
    const v = (row[h] ?? "").trim();
    if (!v) continue;
    out.push({ header: h, value: v });
  }

  return out;
}

export function getFieldsByGroup(
  row: SheetRow,
  headers: string[],
  groupMap: Map<string, RunGroupId>,
): Record<RunGroupId, FieldEntry[]> {
  const acc: Record<RunGroupId, FieldEntry[]> = {
    overview: [],
    timeline: [],
    metrics: [],
    response: [],
    scene: [],
    apparatus: [],
    personnel: [],
    medical: [],
    admin: [],
    notes: [],
    other: [],
  };

  const overviewHeaders = new Set(getOverviewStrip(row, headers, groupMap).map((e) => e.header));

  for (const h of headers) {
    if (isExcludedDetailField(h)) continue;
    const v = (row[h] ?? "").trim();
    if (!v) continue;
    const g = groupMap.get(h) ?? "other";
    if (g === "overview" && overviewHeaders.has(h)) continue;
    acc[g].push({ header: h, value: v });
  }

  return acc;
}

export function getRunTitle(row: SheetRow, headers: string[]): { primary: string; secondary: string | null } {
  const run = findCell(row, headers, ["Run Number", "run number"]);
  const date = findCell(row, headers, ["Date", "date"]);
  const addr = findCell(row, headers, ["Address", "address"]);
  if (run && date) {
    return { primary: `Run ${run}`, secondary: date + (addr ? ` · ${addr}` : "") };
  }
  if (run) return { primary: `Run ${run}`, secondary: addr || date || null };
  const first = headers[0];
  return {
    primary: first ? (row[first] ?? "").trim() || "Run detail" : "Run detail",
    secondary: headers[1] ? (row[headers[1]!] ?? "").trim() || null : null,
  };
}
