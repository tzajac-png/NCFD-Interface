import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  classifyPrimarySupplemental,
  isActiveStatus,
  renderCellValue,
  renderPrimarySupplementalPill,
} from "../lib/callDisplay";
import {
  findStationColumn,
  formatStationTabLabel,
  getCallListSummary,
  getDistinctStationKeys,
  getEffectiveStationKey,
  getRowSortTimestampMs,
} from "../lib/runFieldLayout";
import type { ParsedSheet } from "../types";

interface CallBoardProps {
  sheet: ParsedSheet;
}

export function CallBoard({ sheet }: CallBoardProps) {
  const [query, setQuery] = useState("");
  const [stationTab, setStationTab] = useState<string>("all");
  const [reportTab, setReportTab] = useState<"all" | "primary" | "supplemental">("all");

  const stationHeader = useMemo(() => findStationColumn(sheet.headers), [sheet.headers]);

  const stationKeys = useMemo(
    () => getDistinctStationKeys(sheet.rows, sheet.headers, stationHeader),
    [sheet.rows, sheet.headers, stationHeader],
  );

  const statusHeader = useMemo(() => {
    const h = sheet.headers.find((x) => /status|disposition|state/i.test(x));
    return h ?? null;
  }, [sheet.headers]);

  const deferredQuery = useDeferredValue(query);

  const rowPrep = useMemo(() => {
    const headers = sheet.headers;
    const opts = { statusHeader, stationHeader };
    return sheet.rows.map((row) => ({
      summary: getCallListSummary(row, headers, opts),
      stationKey: getEffectiveStationKey(row, headers, stationHeader),
      sortTs: getRowSortTimestampMs(row, headers),
    }));
  }, [sheet.rows, sheet.headers, statusHeader, stationHeader]);

  const filteredEntries = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const headers = sheet.headers;
    const rows = sheet.rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row, originalIndex }) => {
        const prep = rowPrep[originalIndex]!;
        if (stationTab !== "all") {
          if (prep.stationKey !== stationTab) return false;
        }
        if (reportTab !== "all") {
          const kind = classifyPrimarySupplemental(prep.summary.primarySupplemental);
          if (reportTab === "primary" && kind !== "primary") return false;
          if (reportTab === "supplemental" && kind !== "supplemental") return false;
        }
        if (!q) return true;
        return headers.some((h) => (row[h] ?? "").toLowerCase().includes(q));
      });

    rows.sort((a, b) => {
      const ta = rowPrep[a.originalIndex]!.sortTs;
      const tb = rowPrep[b.originalIndex]!.sortTs;
      if (tb !== ta) return tb - ta;
      return b.originalIndex - a.originalIndex;
    });

    return rows;
  }, [sheet.rows, sheet.headers, deferredQuery, reportTab, rowPrep, stationTab]);

  if (sheet.headers.length === 0) {
    return (
      <div className="ncfd-empty">
        <p>No columns found. Check that your sheet has a header row.</p>
      </div>
    );
  }

  return (
    <div className="call-board">
      <div className="call-board__layout">
        <aside className="call-board__sidebar" aria-label="Search and filters">
          <div className="call-board__toolbar fd-run-log__toolbar">
            <label className="ncfd-search">
              <span className="ncfd-search__label">Search</span>
              <input
                className="ncfd-search__input"
                type="search"
                placeholder="Run number, address, type, status…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
            <p className="call-board__count fd-run-log__count">
              <strong>{filteredEntries.length}</strong> run{filteredEntries.length === 1 ? "" : "s"} shown
              <span className="fd-run-log__count-total"> · {sheet.rows.length} total</span>
            </p>
          </div>

          <div className="call-board__filter-bar">
            <div className="call-board__filter-bar-station">
              {stationKeys.length > 0 ? (
                <>
                  <span className="call-board__filter-inline-label">Station</span>
                  <div className="call-board__tabs call-board__tabs--inline" role="tablist" aria-label="Filter by station">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={stationTab === "all"}
                      className={"call-board__tab" + (stationTab === "all" ? " call-board__tab--active" : "")}
                      onClick={() => setStationTab("all")}
                    >
                      All runs
                    </button>
                    {stationKeys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={stationTab === k}
                        className={"call-board__tab" + (stationTab === k ? " call-board__tab--active" : "")}
                        onClick={() => setStationTab(k)}
                      >
                        {formatStationTabLabel(k)}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="call-board__filter-bar-report">
              <label className="call-board__filter-inline-label" htmlFor="ncfd-report-type-filter">
                Report type
              </label>
              <select
                id="ncfd-report-type-filter"
                className="call-board__select call-board__select--bar"
                value={reportTab}
                onChange={(e) =>
                  setReportTab(e.target.value as "all" | "primary" | "supplemental")
                }
                aria-label="Filter by primary or supplemental report"
              >
                <option value="all">All reports</option>
                <option value="primary">Primary only</option>
                <option value="supplemental">Supplemental only</option>
              </select>
            </div>
          </div>
        </aside>

        <section className="call-board__reports" aria-label="Run list">
          <div className="call-board__reports-screen">
            <div className="fd-run-grid">
              {filteredEntries.map(({ row, originalIndex }) => {
                const summary = rowPrep[originalIndex]!.summary;
                const isHot = summary.status && isActiveStatus(summary.status);
                const runLabel =
                  summary.runNumber.trim() ||
                  summary.date ||
                  `Run ${originalIndex + 1}`;
                const reportBubble = summary.primarySupplemental
                  ? renderPrimarySupplementalPill(summary.primarySupplemental, { variant: "bubble" })
                  : null;

                return (
                  <article
                    key={originalIndex}
                    className={"fd-run-card" + (isHot ? " fd-run-card--active-incident" : "")}
                  >
                    <Link to={`/call/${originalIndex}`} className="fd-run-card__link">
                      <div className="fd-run-card__header">
                        <span className="fd-run-card__id">{runLabel}</span>
                        <div className="fd-run-card__header-right">
                          {summary.status ? (
                            <span className="fd-run-card__status">{renderCellValue(summary.status, true)}</span>
                          ) : (
                            <span className="fd-run-card__status fd-run-card__status--muted">—</span>
                          )}
                        </div>
                      </div>
                      {reportBubble ? (
                        <div className="fd-run-card__report-bubble" aria-label="Report type">
                          {reportBubble}
                        </div>
                      ) : null}
                      <p className="fd-run-card__meta">
                        {[summary.date, summary.time].filter(Boolean).join(" · ")}
                        {summary.station ? ` · ${summary.station}` : ""}
                      </p>
                      {summary.type ? <h3 className="fd-run-card__type">{summary.type}</h3> : null}
                      <p className="fd-run-card__location">
                        {summary.locationLine ? (
                          <>
                            <span className="fd-run-card__location-label">Location</span>
                            {summary.locationLine}
                          </>
                        ) : (
                          <span className="fd-run-card__location-none">Location not listed</span>
                        )}
                      </p>
                      <span className="fd-run-card__cta">
                        Open full report
                        <span className="fd-run-card__cta-arrow" aria-hidden>
                          →
                        </span>
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>

            {filteredEntries.length === 0 ? (
              <p className="fd-run-log__empty">No runs match your filters.</p>
            ) : null}
          </div>
        </section>
      </div>

      <details className="fd-run-log__raw">
        <summary className="fd-run-log__raw-summary">All columns (spreadsheet view)</summary>
        <div className="call-board__table-wrap fd-run-log__table-wrap">
          <table className="ncfd-table">
            <thead>
              <tr>
                <th className="ncfd-table__th-action" scope="col">
                  <span className="visually-hidden">Open detail</span>
                </th>
                {sheet.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(({ row, originalIndex }) => {
                const isHot = statusHeader && isActiveStatus(row[statusHeader] ?? "");
                return (
                  <tr
                    key={originalIndex}
                    className={"ncfd-table__data " + (isHot ? "ncfd-table__row--hot" : "")}
                  >
                    <td className="ncfd-table__action">
                      <Link to={`/call/${originalIndex}`} className="ncfd-table__open-link">
                        View
                      </Link>
                    </td>
                    {sheet.headers.map((h) => {
                      const cell = row[h] ?? "";
                      const isStatus = statusHeader === h;
                      return <td key={h}>{renderCellValue(cell, isStatus)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
