import type { SheetRow } from "../types";

export function isActiveStatus(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v.includes("active") ||
    v.includes("open") ||
    v.includes("enroute") ||
    v.includes("on scene") ||
    v.includes("dispatched")
  );
}

export function isClosedStatus(value: string): boolean {
  const v = value.toLowerCase();
  return v.includes("closed") || v.includes("clear") || v.includes("complete");
}

export type PrimarySupplementalVariant = "compact" | "bubble";

export type PrimarySupplementalKind = "primary" | "supplemental" | "other";

/**
 * Classify a sheet “Primary / Supplemental / Report type” cell (same rules as the pills).
 * Empty → null; unknown wording → "other".
 */
export function classifyPrimarySupplemental(raw: string): PrimarySupplementalKind | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === "s" || t === "sup" || t.startsWith("supp") || (t.includes("supp") && !t.includes("prim"))) {
    return "supplemental";
  }
  if (
    t === "p" ||
    t === "pri" ||
    t.startsWith("prim") ||
    (t.includes("prim") && !t.includes("supp") && !t.includes("station"))
  ) {
    return "primary";
  }
  return "other";
}

/** Primary vs supplemental run (sheet column). Use `bubble` on the main run list for a larger “report” label. */
export function renderPrimarySupplementalPill(
  raw: string,
  opts?: { variant?: PrimarySupplementalVariant },
) {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const bubble = opts?.variant === "bubble";
  let cls = "ncfd-pill ncfd-pill--neutral";
  let label = raw.trim();

  if (t === "s" || t === "sup" || t.startsWith("supp") || (t.includes("supp") && !t.includes("prim"))) {
    cls = "ncfd-pill ncfd-pill--supplemental" + (bubble ? " ncfd-pill--bubble" : "");
    label = bubble ? "Supplemental Report" : "Supplemental";
  } else if (
    t === "p" ||
    t === "pri" ||
    t.startsWith("prim") ||
    (t.includes("prim") && !t.includes("supp") && !t.includes("station"))
  ) {
    cls = "ncfd-pill ncfd-pill--primary-run" + (bubble ? " ncfd-pill--bubble" : "");
    label = bubble ? "Primary Report" : "Primary";
  } else if (bubble) {
    cls = "ncfd-pill ncfd-pill--neutral ncfd-pill--bubble";
  }

  return (
    <span className={cls} title={raw}>
      {label}
    </span>
  );
}

export function renderCellValue(cell: string, isStatus: boolean) {
  if (isStatus && cell) {
    return (
      <span
        className={
          "ncfd-pill " +
          (isActiveStatus(cell)
            ? "ncfd-pill--active"
            : isClosedStatus(cell)
              ? "ncfd-pill--closed"
              : "ncfd-pill--neutral")
        }
      >
        {cell}
      </span>
    );
  }
  return cell;
}

export function CallDetailFields({
  row,
  headers,
  statusHeader,
}: {
  row: SheetRow;
  headers: string[];
  statusHeader: string | null;
}) {
  return (
    <div className="call-detail">
      <p className="call-detail__title">Log entry details</p>
      <dl className="call-detail__list">
        {headers.map((h) => {
          const cell = row[h] ?? "";
          const isStatus = statusHeader === h;
          return (
            <div key={h} className="call-detail__pair">
              <dt>{h}</dt>
              <dd>{renderCellValue(cell, isStatus)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
