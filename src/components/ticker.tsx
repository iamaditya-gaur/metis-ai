const items = [
  "Spend",
  "CTR",
  "CPM",
  "CPC",
  "Cost per result",
  "What changed",
  "Risk flags",
  "Next actions",
  "Your voice",
  "Send-ready",
];

// Full-bleed marquee band. Content is rendered twice so the -50% keyframe
// loops seamlessly; aria-hidden because it repeats facts stated elsewhere.
export function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...items, ...items].map((item, index) => (
          <span key={`${item}-${index}`} className="ticker-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
