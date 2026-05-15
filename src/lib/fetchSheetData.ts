import { SAMPLE_SHEET } from "../data/sampleData";
import type { ParsedSheet } from "../types";
import { gridToObjects, parseCsv } from "./parseCsv";

const SPREADSHEET_ID_DEFAULT = "12H7qOkmveAYnSYBvB1AihnEZ3YfwoLvRL6Akb1TKrq8";
const SHEET_GID_DEFAULT = "197752573";

interface SheetsMetadata {
  sheets?: Array<{
    properties?: { sheetId?: number; title?: string };
  }>;
}

function env(key: string): string {
  const raw = import.meta.env[key as keyof ImportMetaEnv];
  return typeof raw === "string" ? raw.trim() : "";
}

function spreadsheetId(): string {
  return env("VITE_SPREADSHEET_ID") || SPREADSHEET_ID_DEFAULT;
}

function sheetGid(): string {
  return env("VITE_SHEET_GID") || SHEET_GID_DEFAULT;
}

/** CSV export URL for “Anyone with the link can view” sheets (read-only). */
function linkShareExportPaths(): { proxyPath: string; directUrl: string } {
  const id = spreadsheetId();
  const gid = sheetGid();
  const path = `/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  return {
    proxyPath: `/gdoc-csv${path}`,
    directUrl: `https://docs.google.com${path}`,
  };
}

async function fetchJsonWithApiKey(url: string, apiKey: string): Promise<unknown> {
  const sep = url.includes("?") ? "&" : "?";
  const finalUrl = `${url}${sep}key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(finalUrl);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Request failed (${res.status}): ${body.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Reads spreadsheet values via Sheets API v4 (GET only — no writes). */
async function fetchSheetWithSheetsApi(apiKey: string): Promise<ParsedSheet> {
  const id = spreadsheetId();
  const gidStr = sheetGid();
  const explicitRange = env("VITE_SHEET_RANGE");

  let range = explicitRange;
  if (!range) {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties`;
    const meta = (await fetchJsonWithApiKey(metaUrl, apiKey)) as SheetsMetadata;
    const gid = Number(gidStr);
    const sheet = meta.sheets?.find((s) => s.properties?.sheetId === gid);
    const title = sheet?.properties?.title;
    if (!title) {
      const first = meta.sheets?.[0]?.properties?.title;
      if (!first) throw new Error("No sheets found in spreadsheet.");
      range = `'${first.replace(/'/g, "''")}'!A:ZZ`;
    } else {
      range = `'${title.replace(/'/g, "''")}'!A:ZZ`;
    }
  }

  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`;
  const valuesRes = (await fetchJsonWithApiKey(valuesUrl, apiKey)) as { values?: string[][] };
  const grid = valuesRes.values ?? [];
  const { headers, rows } = gridToObjects(grid);
  return { headers, rows };
}

function parseCsvResponse(text: string, context: string): ParsedSheet {
  if (text.includes("Sign in") && text.includes("Google")) {
    throw new Error(`${context}: Google returned a sign-in page. Confirm sharing is “Anyone with the link can view”.`);
  }
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(`${context}: Got HTML instead of CSV (check spreadsheet ID, gid, or deploy proxy).`);
  }
  const grid = parseCsv(text);
  const { headers, rows } = gridToObjects(grid);
  return { headers, rows };
}

async function fetchSheetViaCsvUrl(url: string): Promise<ParsedSheet> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  const text = await res.text();
  return parseCsvResponse(text, "CSV");
}

/** Load tab as CSV via link-share export (same as File → Download → CSV for shared links). */
async function fetchSheetViaLinkShareExport(): Promise<ParsedSheet> {
  const { proxyPath, directUrl } = linkShareExportPaths();
  const attempts: Array<{ url: string; label: string }> = [
    { url: proxyPath, label: "link export (same-origin proxy)" },
    { url: directUrl, label: "link export (direct)" },
  ];

  let lastErr: unknown;
  for (const { url, label } of attempts) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      return parseCsvResponse(text, label);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type DataSource = "api" | "csv" | "sample";

export interface FetchResult {
  data: ParsedSheet;
  source: DataSource;
  error?: string;
}

export async function fetchSheetData(): Promise<FetchResult> {
  const csvUrl = env("VITE_SHEETS_CSV_URL");
  const apiKey = env("VITE_GOOGLE_SHEETS_API_KEY");

  if (csvUrl) {
    try {
      const data = await fetchSheetViaCsvUrl(csvUrl);
      return { data, source: "csv" };
    } catch (e1) {
      try {
        const data = await fetchSheetViaLinkShareExport();
        return {
          data,
          source: "csv",
          error: `Custom CSV URL failed; loaded via link-shared export instead. (${e1 instanceof Error ? e1.message : String(e1)})`,
        };
      } catch {
        const msg = e1 instanceof Error ? e1.message : String(e1);
        return {
          data: SAMPLE_SHEET,
          source: "sample",
          error: `Could not load spreadsheet (${msg}). Showing sample data.`,
        };
      }
    }
  }

  if (apiKey) {
    try {
      const data = await fetchSheetWithSheetsApi(apiKey);
      return { data, source: "api" };
    } catch (e1) {
      try {
        const data = await fetchSheetViaLinkShareExport();
        return {
          data,
          source: "csv",
          error: `API key request failed; loaded via link-shared export instead. (${e1 instanceof Error ? e1.message : String(e1)})`,
        };
      } catch {
        const msg = e1 instanceof Error ? e1.message : String(e1);
        return {
          data: SAMPLE_SHEET,
          source: "sample",
          error: `Could not load spreadsheet (${msg}). Showing sample data.`,
        };
      }
    }
  }

  try {
    const data = await fetchSheetViaLinkShareExport();
    return { data, source: "csv" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      data: SAMPLE_SHEET,
      source: "sample",
      error: `Could not load link-shared sheet (${msg}). Showing sample data. For local dev use npm run dev (Vite proxy). Deployed sites need a /gdoc-csv rewrite (see vercel.json / netlify.toml) or set VITE_GOOGLE_SHEETS_API_KEY.`,
    };
  }
}
