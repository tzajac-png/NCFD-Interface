import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CallBoard } from "./components/CallBoard";
import { Hero } from "./components/Hero";
import { fetchSheetData, type DataSource } from "./lib/fetchSheetData";
import type { ParsedSheet } from "./types";

const CallDetailView = lazy(async () => {
  const m = await import("./components/CallDetailView");
  return { default: m.CallDetailView };
});

function DetailFallback() {
  return <div className="ncfd-loading">Loading viewer…</div>;
}

function sourceLabel(source: DataSource): string {
  switch (source) {
    case "api":
      return "Google Sheets API (read-only)";
    case "csv":
      return "Call log spreadsheet (read-only)";
    default:
      return "Sample data";
  }
}

function HomeView({
  sheet,
  loading,
  banner,
  updatedAt,
  onRefresh,
  source,
}: {
  sheet: ParsedSheet | null;
  loading: boolean;
  banner: string | null;
  updatedAt: Date | null;
  onRefresh: () => void;
  source: DataSource;
}) {
  return (
    <>
      <Hero onRefresh={onRefresh} loading={loading} sourceLabel={sourceLabel(source)} dataSource={source} />

      {banner && (
        <div className="ncfd-banner" role="status">
          {banner}
        </div>
      )}

      {updatedAt && (
        <p className="ncfd-updated">
          Last updated:{" "}
          <time dateTime={updatedAt.toISOString()}>
            {updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </p>
      )}

      {!sheet && loading ? (
        <div className="ncfd-loading">Loading call log…</div>
      ) : sheet ? (
        <div className={loading ? "ncfd-board-dim" : undefined}>
          <CallBoard sheet={sheet} />
        </div>
      ) : null}

      <footer className="ncfd-footer">
        <p>
          NCFD — For official records, use your CAD / records system. This call log mirrors the linked spreadsheet only.
        </p>
      </footer>
    </>
  );
}

function AppRoutes() {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [source, setSource] = useState<DataSource>("sample");
  const [loading, setLoading] = useState(true);
  const [fetchBanner, setFetchBanner] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    const bg = opts?.background === true;
    if (!bg) {
      setLoading(true);
      setFetchBanner(null);
    }
    try {
      const result = await fetchSheetData();
      setSheet(result.data);
      setSource(result.source);
      setUpdatedAt(new Date());
      if (result.error) {
        if (!bg) setFetchBanner(result.error);
      } else if (!bg) {
        setFetchBanner(null);
      }
    } catch (e) {
      if (!bg) setFetchBanner(e instanceof Error ? e.message : "Could not load data.");
    } finally {
      if (!bg) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (source === "sample") return;
    const id = window.setInterval(() => void load({ background: true }), 60_000);
    return () => window.clearInterval(id);
  }, [source, load]);

  return (
    <div className="app-shell">
      <Routes>
        <Route
          path="/"
          element={
            <HomeView
              sheet={sheet}
              loading={loading}
              banner={fetchBanner}
              updatedAt={updatedAt}
              onRefresh={() => void load()}
              source={source}
            />
          }
        />
        <Route
          path="/call/:rowIndex"
          element={
            sheet ? (
              <Suspense fallback={<DetailFallback />}>
                <CallDetailView sheet={sheet} />
              </Suspense>
            ) : loading ? (
              <div className="ncfd-loading">Loading…</div>
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
