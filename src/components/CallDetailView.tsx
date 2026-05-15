import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  RUN_GROUP_ORDER,
  findStationColumn,
  getCallListSummary,
  getFieldsByGroup,
  getGroupLabel,
  getOverviewStrip,
  getRunTitle,
  groupRunFields,
  type RunGroupId,
} from "../lib/runFieldLayout";
import type { ParsedSheet, SheetRow } from "../types";
import { renderPrimarySupplementalPill } from "../lib/callDisplay";
import "../run-detail.css";

interface CallDetailViewProps {
  sheet: ParsedSheet;
}

export function CallDetailView({ sheet }: CallDetailViewProps) {
  const { rowIndex: rowParam } = useParams<{ rowIndex: string }>();
  const rowIndex = rowParam != null ? Number.parseInt(rowParam, 10) : NaN;
  const indexOk =
    Number.isFinite(rowIndex) && rowIndex >= 0 && rowIndex < sheet.rows.length;
  const row: SheetRow = indexOk ? sheet.rows[rowIndex]! : {};
  const headers = sheet.headers;

  const groupMap = useMemo(() => groupRunFields(headers), [headers]);
  const stationHeader = useMemo(() => findStationColumn(headers), [headers]);
  const statusHeader = useMemo(() => {
    const h = headers.find((x) => /status|disposition|state/i.test(x));
    return h ?? null;
  }, [headers]);
  const listSummary = useMemo(
    () => getCallListSummary(row, headers, { statusHeader, stationHeader }),
    [row, headers, statusHeader, stationHeader],
  );
  const overviewStrip = useMemo(
    () => getOverviewStrip(row, headers, groupMap),
    [row, headers, groupMap],
  );
  const byGroup = useMemo(() => getFieldsByGroup(row, headers, groupMap), [row, headers, groupMap]);
  const title = useMemo(() => getRunTitle(row, headers), [row, headers]);
  const primaryPill = useMemo(
    () => (listSummary.primarySupplemental ? renderPrimarySupplementalPill(listSummary.primarySupplemental) : null),
    [listSummary.primarySupplemental],
  );

  if (!indexOk) {
    return <Navigate to="/" replace />;
  }

  const groupsToShow = RUN_GROUP_ORDER.filter((g) => {
    if (g === "overview") return false;
    return (byGroup[g]?.length ?? 0) > 0;
  });

  return (
    <div className="call-detail-screen">
      <div className="call-detail-screen__blend" aria-hidden />
      <header className="call-detail-screen__header">
        <Link to="/" className="call-detail-screen__back">
          ← Back to run log
        </Link>
        <div className="call-detail-screen__heading-block">
          <p className="run-detail__page-eyebrow">Submitted run · Viewer</p>
          <h1 className="call-detail-screen__title">{title.primary}</h1>
          {title.secondary ? <p className="call-detail-screen__meta">{title.secondary}</p> : null}
          {(primaryPill || listSummary.station) ? (
            <div className="call-detail-screen__run-badges">
              {primaryPill}
              {listSummary.station ? (
                <span className="ncfd-pill ncfd-pill--neutral call-detail-screen__station-pill">
                  {listSummary.station}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className="call-detail-screen__main run-detail">
        {overviewStrip.length > 0 ? (
          <section className="run-detail__summary" aria-labelledby="run-summary-heading">
            <h2 id="run-summary-heading" className="run-detail__summary-title">
              Key information
            </h2>
            <div className="run-detail__summary-grid">
              {overviewStrip.map(({ header, value }) => (
                <div key={header} className="run-detail__field">
                  <span className="run-detail__field-label">{header}</span>
                  <p className="run-detail__field-value">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {groupsToShow.map((gid) => (
          <RunSection key={gid} groupId={gid} entries={byGroup[gid] ?? []} />
        ))}
      </main>

      <footer className="call-detail-screen__footer">
        <p>
          Run {rowIndex + 1} of {sheet.rows.length}
        </p>
      </footer>
    </div>
  );
}

function RunSection({
  groupId,
  entries,
}: {
  groupId: RunGroupId;
  entries: { header: string; value: string }[];
}) {
  if (entries.length === 0) return null;
  const dense = groupId !== "apparatus";
  return (
    <section className="run-detail__section" aria-labelledby={`sec-${groupId}`}>
      <h2 id={`sec-${groupId}`} className="run-detail__section-head">
        {getGroupLabel(groupId)}
      </h2>
      <div className="run-detail__section-body">
        <dl className={"run-detail__dl " + (dense ? "run-detail__dl--dense" : "") + (groupId === "apparatus" ? " run-detail__apparatus-grid" : "")}>
          {entries.map(({ header, value }) => (
            <div key={header} className="run-detail__dl-row">
              <dt>{header}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
