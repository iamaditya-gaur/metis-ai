const items = [
  "Real numbers, straight from Meta",
  "Your voice, not a template's",
  "Send-ready in seconds",
  "45 minutes back, every report",
  "Weekly, monthly, any cadence",
  "Copy, paste, done",
];

// Full-bleed marquee band. Content is rendered twice so the -50% keyframe
// loops seamlessly; aria-hidden because it repeats claims stated elsewhere.
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
