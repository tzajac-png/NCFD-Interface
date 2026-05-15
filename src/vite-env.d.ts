/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_SHEETS_API_KEY: string;
  readonly VITE_SPREADSHEET_ID: string;
  readonly VITE_SHEET_GID: string;
  /** Optional explicit range, e.g. "Calls!A:Z" — overrides gid lookup */
  readonly VITE_SHEET_RANGE: string;
  /** Published CSV URL (File → Share → Publish to web) */
  readonly VITE_SHEETS_CSV_URL: string;
  /** Optional: override logo URL (default /logo.png in public/) */
  readonly VITE_LOGO_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
