type MetricTileProps = {
  kicker: string;
  value: string;
  copy: string;
};

export function MetricTile({ kicker, value, copy }: MetricTileProps) {
  return (
    <article className="metric-tile">
      <span className="metric-kicker">{kicker}</span>
      <strong className="metric-value">{value}</strong>
      <p className="metric-copy">{copy}</p>
    </article>
  );
}
