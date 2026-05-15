import type { DataSource } from "../lib/fetchSheetData";

function logoSrc(): string {
  const fromEnv = import.meta.env.VITE_LOGO_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return fromEnv.trim();
  return "/logo.png";
}

export interface HeroProps {
  onRefresh: () => void;
  loading: boolean;
  sourceLabel: string;
  dataSource: DataSource;
}

export function Hero({ onRefresh, loading, sourceLabel, dataSource }: HeroProps) {
  return (
    <section className="ncfd-hero" aria-label="NCFD Call Log">
      <div className="ncfd-hero__blend" aria-hidden />
      <div className="ncfd-hero__inner">
        <div className="ncfd-hero__masthead">
          <div className="ncfd-hero__logo-mark">
            <img
              src={logoSrc()}
              alt="NCFD — Cities of Northville and Plymouth"
              className="ncfd-hero__logo"
              width={200}
              height={240}
            />
          </div>
          <div className="ncfd-hero__brand">
            <p className="ncfd-hero__eyebrow">Northville · Plymouth</p>
            <h1 className="ncfd-hero__title">NCFD Call Log</h1>
            <p className="ncfd-hero__subtitle">
              Browse submitted runs — open any row for the full report, timeline, apparatus, and map.
            </p>
          </div>
        </div>

        <nav className="ncfd-main-menu" aria-label="Main menu">
          <div className="ncfd-main-menu__rail">
            <span className="ncfd-main-menu__item ncfd-main-menu__item--current" aria-current="page">
              Submitted runs
            </span>
          </div>
          <div className="ncfd-main-menu__actions ncfd-main-menu__actions--split">
            <span className="ncfd-main-menu__source" title="How data is loaded">
              {sourceLabel}
              {dataSource === "sample" ? " · Link-share export or API key unavailable" : null}
            </span>
            <div className="ncfd-main-menu__buttons">
              <button type="button" className="ncfd-btn ncfd-btn--primary" onClick={onRefresh} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </nav>
      </div>
    </section>
  );
}
