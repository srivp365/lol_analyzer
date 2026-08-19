import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import { Spinner } from "@heroui/react";

type MatchRow = {
  win?: boolean;
  kda?: string | number;
  kills?: number;
  deaths?: number;
  assists?: number;
  kill_participation?: number;
  match_id?: string;
};

type GoldTimelinePoint = {
  timestamp_min?: number;
  player_gold?: number;
  enemy_gold?: number;
  gold_diff?: number;
};

type DashboardPayload = {
  summonerName?: string;
  summonerTag?: string;
  region?: string;
  queueType?: string;
  performanceRating?: string | number;
  performanceSummaryText?: string;
  csAnalysis?: {
    csPerMinute?: string | number;
    lanePhaseCsDifferential?: string | number;
    summary?: {
      avg_cs_per_min?: string | number;
      avg_cs_at_10?: string | number;
    };
  };
  visionAnalysis?: {
    visionScorePerMin?: string | number;
    wardsCleared?: string | number;
    summary?: {
      avg_vision_score?: string | number;
      avg_wards_placed?: string | number;
    };
  };
  kdaAnalysis?: {
    matches?: MatchRow[];
    summary?: {
      avg_kill_participation?: number;
      lifetime_kills?: number;
      lifetime_deaths?: number;
      lifetime_assists?: number;
      avg_kda?: string | number;
      avg_win_rate?: number;
    };
  };
  gdlAnalysis?: {
    match_id: string;
    position: string;
    laning_phase: {
      "5m": number;
      "10m": number;
      "15m": number;
    };
    timeline: [];
  };
};

const fetchPlayerDashboard = async ({ queryKey }: any) => {
  const [_key, gameName, tagLine, region] = queryKey;

  if (!gameName || !tagLine || !region) {
    throw new Error("Missing Riot account name or tag.");
  }

  // 1. Add the /api/ prefix so Nginx routes it to the backend container
  const response = await fetch(`/api/${region}/${gameName}/${tagLine}`);

  if (!response.ok) {
    throw new Error("Failed to fetch player data. They might not exist.");
  }

  // 2. Parse the JSON exactly ONE time
  const data = await response.json();

  console.log(`Received dashboard payload for ${gameName}#${tagLine}:`, data);

  // 3. Return the saved data
  return data as DashboardPayload;
};
const statusRows = ["Account lookup", "Match history", "Ranked telemetry"];

function asDisplayValue(value: unknown, fallback = "--") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  }

  return String(value);
}

function formatPercent(value: unknown, fallback = "--") {
  if (typeof value !== "number") {
    return fallback;
  }

  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function formatGoldDelta(value: unknown) {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${Math.round(value)}`;
}

function getKdaRatio(match: MatchRow) {
  if (match.kda !== undefined && match.kda !== null && match.kda !== "") {
    return asDisplayValue(match.kda);
  }

  const kills = match.kills ?? 0;
  const deaths = match.deaths ?? 0;
  const assists = match.assists ?? 0;

  if (!kills && !deaths && !assists) {
    return "--";
  }

  if (deaths === 0) {
    return "Perfect";
  }

  return ((kills + assists) / deaths).toFixed(2);
}

function getMatchResult(match: MatchRow) {
  if (typeof match.win === "boolean") {
    return match.win ? "Win" : "Loss";
  }

  return "Unknown";
}

function getKdaBreakdown(match: MatchRow) {
  return `${match.kills ?? 0} / ${match.deaths ?? 0} / ${match.assists ?? 0}`;
}

function getGoldMilestone(timeline: GoldTimelinePoint[], minute: number) {
  return timeline.find((point) => point?.timestamp_min === minute);
}

function DashboardStatus({
  state,
  gameName,
  tagLine,
  message,
}: {
  state: "loading" | "error";
  gameName?: string;
  tagLine?: string;
  region?: string;
  message?: string;
}) {
  const isError = state === "error";

  return (
    <main className="dashboard-view">
      <DashboardStyles />
      <section className="dashboard-state-shell" aria-live="polite">
        <div className="dashboard-state-panel">
          <header className="dashboard-state-header">
            <div>
              <div className="dashboard-state-loading-header">
                <Spinner
                  color="current"
                  size="sm"
                  className="dashboard-state-spinner"
                />
                <p className={isError ? "eyebrow eyebrow-danger" : "eyebrow"}>
                  {isError ? "Request failed" : "Fetching match data"}
                </p>
              </div>
              <h1 className="dashboard-state-title">
                {isError
                  ? "Could not build the report."
                  : "Building the match report."}
              </h1>
            </div>

            <div className="header-meta" aria-label="Requested player">
              <div className="meta">
                <span>Name</span>
                <strong>{gameName ?? "Unknown"}</strong>
              </div>
              <div className="meta">
                <span>Tag</span>
                <strong>{tagLine ?? "Unknown"}</strong>
              </div>
            </div>
          </header>

          <div className="dashboard-state-body">
            <div className="dashboard-state-list">
              {statusRows.map((row, index) => (
                <div className="dashboard-state-row" key={row}>
                  <span
                    className={
                      isError
                        ? "dashboard-state-mark dashboard-state-mark-danger"
                        : "dashboard-state-mark"
                    }
                  />
                  <span>{row}</span>
                  <span>
                    {isError ? "Halted" : index === 0 ? "Active" : "Queued"}
                  </span>
                </div>
              ))}
            </div>

            <aside>
              <p
                className={
                  isError
                    ? "dashboard-state-message dashboard-state-message-danger"
                    : "dashboard-state-message"
                }
              >
                {isError
                  ? message
                  : "Contacting the local analyzer and preparing the dashboard rows. This usually takes a moment when the match sample is cold."}
              </p>
              <a className="dashboard-state-action" href="/">
                {isError ? "Back to search" : "Return to player search"}
              </a>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function Dashboard() {
  const { gameName, tagLine, region } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["playerStats", gameName, tagLine, region],
    queryFn: fetchPlayerDashboard,
    enabled: !!gameName && !!tagLine && !!region,
    placeholderData: (previousData) => previousData,
  });

  if (isLoading) {
    return (
      <DashboardStatus
        state="loading"
        gameName={gameName}
        tagLine={tagLine}
        region={region}
      />
    );
  }

  if (isError) {
    return (
      <DashboardStatus
        state="error"
        gameName={gameName}
        tagLine={tagLine}
        message={
          error instanceof Error
            ? error.message
            : "The analyzer returned an unknown error."
        }
      />
    );
  }

  const profileName = data?.summonerName ?? gameName ?? "Unknown player";
  const profileTag = data?.summonerTag ?? tagLine ?? "Unknown";
  const kdaSummary = data?.kdaAnalysis?.summary;
  const matches = data?.kdaAnalysis?.matches ?? [];
  const goldTimeline = data?.gdlAnalysis?.timeline ?? [];
  const goldMilestones = [5, 10, 15].map((minute) => ({
    minute,
    point: getGoldMilestone(goldTimeline, minute),
  }));
  const combatVolume =
    (kdaSummary?.lifetime_kills ?? 0) +
    (kdaSummary?.lifetime_deaths ?? 0) +
    (kdaSummary?.lifetime_assists ?? 0);
  const analytics = [
    {
      label: "Win rate",
      value: formatPercent(kdaSummary?.avg_win_rate),
      note: "Lifetime sample",
    },
    {
      label: "Lifetime KDA",
      value: asDisplayValue(kdaSummary?.avg_kda),
      note: "Kills and assists per death",
    },
    {
      label: "Kill participation",
      value: formatPercent(kdaSummary?.avg_kill_participation),
      note: "Average team fight share",
    },
    {
      label: "Combat volume",
      value: asDisplayValue(combatVolume || undefined),
      note: `${kdaSummary?.lifetime_kills ?? 0}K / ${kdaSummary?.lifetime_deaths ?? 0}D / ${kdaSummary?.lifetime_assists ?? 0}A`,
    },
  ];

  return (
    <main className="dashboard-view">
      <DashboardStyles />

      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Match History / Analytics</p>
            <h1 className="dashboard-title" id="dashboard-title">
              {profileName}#{profileTag}
            </h1>
          </div>

          <div className="header-actions">
            <NavLink
              className="dashboard-state-action dashboard-state-action-header"
              to="/"
              end
            >
              Return to player search{" "}
            </NavLink>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="history-panel" aria-labelledby="history-title">
            <div className="section-heading">
              <h2 id="history-title">Recent matches</h2>
              <span>KDA source</span>
            </div>

            <div className="analytics-strip" aria-label="Key analytics">
              {analytics.map((item) => (
                <article className="metric" key={item.label}>
                  <p className="metric-label">{item.label}</p>
                  <strong className="metric-value">
                    {asDisplayValue(item.value)}
                  </strong>
                  <span className="metric-note">{item.note}</span>
                </article>
              ))}
            </div>

            <div className="subpanel-grid" aria-label="CS and vision analysis">
              <article className="subpanel">
                <p className="metric-label">CS analysis</p>
                <div className="subpanel-pair">
                  <span>CS / min</span>
                  <strong>
                    {asDisplayValue(
                      data?.csAnalysis?.csPerMinute ??
                        data?.csAnalysis?.summary?.avg_cs_per_min,
                    )}
                  </strong>
                </div>
                <div className="subpanel-pair">
                  <span>Lane phase diff</span>
                  <strong>
                    {asDisplayValue(
                      data?.csAnalysis?.lanePhaseCsDifferential ??
                        data?.csAnalysis?.summary?.avg_cs_at_10,
                    )}
                  </strong>
                </div>
              </article>

              <article className="subpanel">
                <p className="metric-label">Vision analysis</p>
                <div className="subpanel-pair">
                  <span>Vision / min</span>
                  <strong>
                    {asDisplayValue(
                      data?.visionAnalysis?.visionScorePerMin ??
                        data?.visionAnalysis?.summary?.avg_vision_score,
                    )}
                  </strong>
                </div>
                <div className="subpanel-pair">
                  <span>Wards cleared</span>
                  <strong>
                    {asDisplayValue(
                      data?.visionAnalysis?.wardsCleared ??
                        data?.visionAnalysis?.summary?.avg_wards_placed,
                    )}
                  </strong>
                </div>
              </article>
            </div>

            <div
              className="history-table"
              role="table"
              aria-label="Match history"
            >
              <div className="history-head" role="row">
                <span>Match ID</span>
                <span>Result</span>
                <span>K / D / A</span>
                <span>Kill participation</span>
                <span>KDA ratio</span>
              </div>

              {matches?.length ? (
                matches.map((match, index) => {
                  const result = getMatchResult(match);
                  const resultClass =
                    result.toLowerCase() === "win" ? "tag-win" : "tag-loss";

                  return (
                    <div
                      className="match-row"
                      role="row"
                      key={match?.match_id ?? `match-${index}`}
                    >
                      <span className="match-id">
                        {match?.match_id ?? `Match ${index + 1}`}
                      </span>
                      <span className={`tag ${resultClass}`}>{result}</span>
                      <span>{getKdaBreakdown(match)}</span>
                      <span>{formatPercent(match?.kill_participation)}</span>
                      <span className="match-kda">{getKdaRatio(match)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="empty-row" role="row">
                  No matches returned by the analyzer.
                </div>
              )}
            </div>
          </section>

          <aside className="side-panel" aria-label="Analyst notes">
            <div className="summary-block">
              <p className="eyebrow">Performance Index</p>
              <p className="summary-number">
                {asDisplayValue(data?.performanceRating ?? kdaSummary?.avg_kda)}
              </p>
              <p className="summary-copy">
                {data?.performanceSummaryText ??
                  "Combat reads are derived from lifetime KDA, win rate, and kill participation across the current stored sample."}
              </p>
            </div>

            <div
              className="gold-panel"
              aria-label="Minute-by-minute gold delta telemetry"
            >
              <div className="section-heading section-heading-compact">
                <h2>Laning Phase Delta For Latest Match</h2>
                <span>{data?.gdlAnalysis?.position ?? "LANE"}</span>
              </div>

              <div className="gold-log-head">
                <span>Time</span>
                <span>Player</span>
                <span>Enemy</span>
                <span>Diff</span>
              </div>

              {goldMilestones.map(({ minute, point }) => {
                const diff = point?.gold_diff;
                const diffClass =
                  typeof diff === "number" && diff < 0
                    ? "gold-diff gold-diff-danger"
                    : "gold-diff gold-diff-positive";

                return (
                  <div className="gold-log-row" key={minute}>
                    <span>{minute}m</span>
                    <span>{asDisplayValue(point?.player_gold)}</span>
                    <span>{asDisplayValue(point?.enemy_gold)}</span>
                    <span className={diffClass}>{formatGoldDelta(diff)}</span>
                  </div>
                );
              })}
            </div>

            <div className="header-meta" aria-label="Dashboard metadata">
              <div className="meta">
                <span>Region</span>
                <strong>{data?.region ?? "NA"}</strong>
              </div>
              <div className="meta">
                <span>Queue</span>
                <strong>{data?.queueType ?? "Ranked Solo"}</strong>
              </div>
              <div className="meta">
                <span>Sample</span>
                <strong>{matches?.length ?? 0} games</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function DashboardStyles() {
  return (
    <style>{`
      .dashboard-view {
        min-height: 100vh;
        background: #0a0a0a;
        color: #eaeaea;
        font-family: "SF Pro Display", "Geist Sans", "Helvetica Neue", Arial, sans-serif;
        padding: 28px;
      }

      .dashboard-shell,
      .dashboard-state-panel {
        max-width: 1280px;
        margin: 0 auto;
        border: 1px solid #2a2a2a;
        border-radius: 0;
        background: #101010;
      }

      .dashboard-header,
      .dashboard-state-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        padding: 30px 32px 28px;
        border-bottom: 1px solid #2a2a2a;
      }

      .dashboard-header {
        align-items: start;
      }

      .header-actions {
        display: flex;
        align-items: end;
        justify-content: flex-end;
      }

      .dashboard-state-action-header {
        margin: 0;
      }

      .eyebrow,
      .meta,
      .metric-label,
      .history-head,
      .match-row,
      .tag,
      .gold-log-head,
      .gold-log-row,
      .profile-row,
      .subpanel-pair,
      .dashboard-state-row,
      .dashboard-state-message,
      .dashboard-state-action {
        font-family: "Geist Mono", "SF Mono", "JetBrains Mono", Consolas, monospace;
        letter-spacing: 0;
      }

      .eyebrow {
        margin: 0 0 12px;
        color: #8b8b8b;
        font-size: 11px;
        text-transform: uppercase;
      }

      .dashboard-state-loading-header {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0px;
        color: #eaeaea;
      }

      .dashboard-state-loading-header .eyebrow {
        margin: 0;
        line-height: 1;
      }

      .dashboard-state-spinner {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        min-width: 1rem;
        min-height: 1rem;
      }

      .dashboard-state-spinner svg {
        display: block;
      }

      .eyebrow-danger {
        color: #ff8a8a;
      }

      .dashboard-title,
      .dashboard-state-title {
        max-width: 760px;
        margin: 0;
        color: #f4f4f0;
        font-family: "Newsreader", "Lyon Text", Georgia, serif;
        font-size: clamp(42px, 6vw, 82px);
        line-height: 1.04;
        letter-spacing: 0;
        font-weight: 500;
      }

      .header-meta {
        display: grid;
        align-content: end;
        gap: 8px;
        min-width: 230px;
        color: #8b8b8b;
        font-size: 12px;

      }

      .meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        padding-bottom: 8px;
        border-bottom: 1px solid #2a2a2a;
        padding: 4px 20px;
      }

      .meta strong {
        color: #eaeaea;
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
        min-height: 680px;
      }

      .history-panel {
        border-right: 1px solid #2a2a2a;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 54px;
        padding: 0 24px;
        border-bottom: 1px solid #2a2a2a;
      }

      .section-heading h2 {
        margin: 0;
        color: #f4f4f0;
        font-size: 14px;
        font-weight: 650;
      }

      .section-heading span {
        color: #8b8b8b;
        font-size: 12px;
      }

      .analytics-strip,
      .subpanel-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-bottom: 1px solid #2a2a2a;
      }

      .subpanel-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .metric,
      .subpanel {
        min-height: 116px;
        padding: 18px 20px;
        border-right: 1px solid #2a2a2a;
      }

      .metric:last-child,
      .subpanel:last-child {
        border-right: 0;
      }

      .metric-label {
        margin: 0 0 18px;
        color: #8b8b8b;
        font-size: 11px;
        text-transform: uppercase;
      }

      .metric-value {
        display: block;
        color: #ff2a2a;
        font-size: 34px;
        line-height: 1;
        font-weight: 620;
      }

      .metric-note {
        display: block;
        margin-top: 10px;
        color: #8b8b8b;
        font-size: 12px;
      }

      .subpanel-pair {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 10px 0;
        border-top: 1px solid #2a2a2a;
        color: #8b8b8b;
        font-size: 12px;
      }

      .subpanel-pair strong {
        color: #ff2a2a;
      }

      .history-table {
        width: 100%;
      }

      .history-head,
      .match-row {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) 0.56fr 0.74fr 1fr 0.68fr;
        align-items: center;
        column-gap: 16px;
      }

      .history-head {
        min-height: 38px;
        padding: 0 20px;
        border-bottom: 1px solid #2a2a2a;
        color: #747474;
        font-size: 10px;
        text-transform: uppercase;
      }

      .match-row,
      .empty-row {
        min-height: 68px;
        padding: 0 20px;
        border-bottom: 1px solid #2a2a2a;
        color: #bdbdbd;
        font-size: 12px;
      }

      .match-row:hover {
        background: #141414;
      }

      .match-row:last-child {
        border-bottom: 0;
      }

      .empty-row {
        display: flex;
        align-items: center;
        color: #8b8b8b;
      }

      .match-id {
        overflow: hidden;
        color: #bdbdbd;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .match-kda {
        color: #ff2a2a;
      }

      .champion {
        display: grid;
        gap: 4px;
        font-family: "SF Pro Display", "Geist Sans", "Helvetica Neue", Arial, sans-serif;
      }

      .champion strong {
        color: #f4f4f0;
        font-size: 14px;
        font-weight: 650;
      }

      .champion span {
        color: #8b8b8b;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tag {
        width: fit-content;
        padding: 3px 8px;
        border: 1px solid transparent;
        border-radius: 0;
        font-size: 10px;
        text-transform: uppercase;
      }

      .tag-win {
        background: rgba(255, 42, 42, 0.12);
        color: #ff8a8a;
        border-color: rgba(255, 42, 42, 0.28);
      }

      .tag-loss {
        background: #181818;
        color: #9c9c9c;
        border-color: #343434;
      }

      .side-panel {
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .summary-block {
        padding: 24px;
        border-bottom: 1px solid #2a2a2a;
      }

      .summary-number {
        margin: 0;
        color: #ff2a2a;
        font-family: "Newsreader", "Lyon Text", Georgia, serif;
        font-size: 64px;
        line-height: 0.95;
        letter-spacing: 0;
      }

      .summary-copy {
        margin: 16px 0 0;
        color: #bdbdbd;
        font-size: 14px;
        line-height: 1.55;
      }

      .gold-panel {
        border-bottom: 1px solid #2a2a2a;
      }

      .section-heading-compact {
        min-height: 46px;
        padding: 0 24px;
      }

      .gold-log-head,
      .gold-log-row {
        display: grid;
        grid-template-columns: 0.55fr 1fr 1fr 0.8fr;
        align-items: center;
        column-gap: 12px;
        padding: 0 24px;
      }

      .gold-log-head {
        min-height: 34px;
        border-bottom: 1px solid #2a2a2a;
        color: #747474;
        font-size: 10px;
        text-transform: uppercase;
      }

      .gold-log-row {
        min-height: 48px;
        border-bottom: 1px solid #2a2a2a;
        color: #bdbdbd;
        font-size: 12px;
      }

      .gold-log-row:last-child {
        border-bottom: 0;
      }

      .gold-diff {
        color: #8b8b8b;
      }

      .gold-diff-positive {
        color: #ff2a2a;
      }

      .gold-diff-danger {
        color: #8b8b8b;
      }

      .profile-panel {
        display: grid;
        align-content: start;
      }

      .profile-row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 18px 24px;
        border-bottom: 1px solid #2a2a2a;
        color: #8b8b8b;
        font-size: 12px;
        text-transform: uppercase;
      }

      .profile-row strong {
        color: #eaeaea;
        text-align: right;
      }

      .dashboard-state-shell {
        max-width: 920px;
        min-height: calc(100vh - 56px);
        margin: 0 auto;
        display: grid;
        align-content: center;
      }

      .dashboard-state-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 0.44fr);
      }

      .dashboard-state-list {
        border-right: 1px solid #2a2a2a;
      }

      .dashboard-state-row {
        min-height: 58px;
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        padding: 0 24px;
        border-bottom: 1px solid #2a2a2a;
        color: #bdbdbd;
        font-size: 12px;
        text-transform: uppercase;
      }

      .dashboard-state-mark {
        width: 9px;
        height: 9px;
        background: #eaeaea;
      }

      .dashboard-state-mark-danger {
        background: #ff2a2a;
      }

      .dashboard-state-row span:last-child {
        color: #8b8b8b;
      }

      .dashboard-state-message {
        margin: 0;
        padding: 24px;
        color: #bdbdbd;
        font-size: 12px;
        line-height: 1.6;
        border-bottom: 1px solid #2a2a2a;
      }

      .dashboard-state-message-danger {
        color: #ff8a8a;
      }

      .dashboard-state-action {
        display: inline-flex;
        min-height: 52px;
        align-items: center;
        justify-content: center;
        margin: 24px;
        padding: 0 24px;
        border: 1px solid #eaeaea;
        border-radius: 0;
        background: #111;
        color: #eaeaea;
        text-decoration: none;
        text-transform: uppercase;
        letter-spacing: 0;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
      }

      .dashboard-state-action:hover,
      .dashboard-state-action:focus-visible {
        background: #ff2a2a;
        color: #0a0a0a;
        outline: none;
      }

      @media (max-width: 1050px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }

        .history-panel {
          border-right: 0;
          border-bottom: 1px solid #2a2a2a;
        }

        .analytics-strip {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .metric:nth-child(2) {
          border-right: 0;
        }
      }

      @media (max-width: 760px) {
        .dashboard-view {
          padding: 12px;
        }

        .dashboard-header,
        .dashboard-state-header,
        .dashboard-state-body {
          grid-template-columns: 1fr;
          padding: 24px 18px;
        }

        .header-meta {
          min-width: 0;
        }

        .analytics-strip,
        .subpanel-grid {
          grid-template-columns: 1fr;
        }

        .metric,
        .subpanel {
          border-right: 0;
        }

        .history-head {
          display: none;
        }

        .match-row {
          grid-template-columns: 1fr auto;
          row-gap: 8px;
          padding: 16px 18px;
        }

        .match-row > span:nth-child(n + 4) {
          display: none;
        }

        .match-row .tag {
          justify-self: end;
        }

        .dashboard-state-list {
          border-right: 0;
          border-bottom: 1px solid #2a2a2a;
        }
      }
    `}</style>
  );
}

export default Dashboard;
