// A compact row of board metrics above the ticket table (spec section 6.3). Numbers only, no charts.
// Reads board_ticket_metrics and board_ticket_counts; reloads when `version` changes (after each save).
import { useEffect, useState } from "react";
import { loadMetrics, type BoardMetrics } from "./api";
import { sourceLabel, type Source } from "./types";
import { useTypeClass } from "../../lib/board";

const days = (value: number | null) => (value === null ? "–" : `${Number.isInteger(value) ? value : value.toFixed(1)}d`);

export default function MetricsStrip({ board, version }: { board: string; version: number }) {
  const [metrics, setMetrics] = useState<BoardMetrics | null>(null);
  const [failed, setFailed] = useState(false);
  const typeClass = useTypeClass();

  useEffect(() => {
    let cancelled = false;
    loadMetrics(board)
      .then((loaded) => { if (!cancelled) { setMetrics(loaded); setFailed(false); } })
      .catch((error) => { console.error(error); if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [board, version]);

  if (failed && !metrics) return <div className="metrics-strip muted" role="status">Metrics unavailable</div>;
  if (!metrics) return <div className="metrics-strip muted" role="status">Loading metrics…</div>;

  const { byStatus } = metrics;
  return (
    <section className="metrics-strip" aria-label="Board metrics">
      <dl className="metrics-group">
        <div className="metric"><dt>Open</dt><dd>{metrics.openCount}</dd></div>
        <div className={`metric ${metrics.overdueCount ? "alert" : ""}`}><dt>Overdue</dt><dd>{metrics.overdueCount}</dd></div>
        <div className="metric" title="Median days from submitted to closed, over closed tickets"><dt>Median to close</dt><dd>{days(metrics.medianDaysToClose)}</dd></div>
        <div className="metric" title="Median and oldest age of open tickets, in days since submitted"><dt>Open age</dt><dd>{days(metrics.medianOpenAgeDays)} <small>max {days(metrics.maxOpenAgeDays)}</small></dd></div>
      </dl>
      <dl className="metrics-group" aria-label="By status">
        <div className="metric small"><dt><span className="tag status to-do"><i />Open</span></dt><dd>{byStatus.open}</dd></div>
        <div className="metric small"><dt><span className="tag status in-progress"><i />In Progress</span></dt><dd>{byStatus.inProgress}</dd></div>
        <div className="metric small"><dt><span className="tag status complete"><i />Closed</span></dt><dd>{byStatus.closed}</dd></div>
      </dl>
      {metrics.byType.length > 0 && (
        <dl className="metrics-group" aria-label="By type">
          {metrics.byType.map(({ label, count }) => (
            <div key={label} className="metric small"><dt><span className={`tag type ${typeClass(label)}`}>{label}</span></dt><dd>{count}</dd></div>
          ))}
        </dl>
      )}
      {metrics.bySource.length > 0 && (
        <dl className="metrics-group" aria-label="By source">
          {metrics.bySource.map(({ source, count }) => (
            <div key={source} className="metric small"><dt><span className={`tag source ${source}`}>{sourceLabel[source as Source] ?? source}</span></dt><dd>{count}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}
