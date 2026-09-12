// Side ledger of event details during intake.

function Dots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "6px 0" }}>
      <div className="dot" />
      <div className="dot dot2" />
      <div className="dot dot3" />
    </div>
  );
}

export default function Ledger({ rows, meta }) {
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        padding: "64px 48px 40px 32px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 600, color: "#475467", letterSpacing: ".02em" }}
        >
          Event details
        </div>
        <div style={{ fontSize: 13, color: "#98a2b3" }}>{meta}</div>
      </div>
      <div style={{ height: 1, background: "#12305e", marginBottom: 4 }} />
      {rows.map((l) => (
        <div
          key={l.key}
          className="ledger"
          onClick={l.onPick}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 14,
            padding: "11px 0",
            borderBottom: "1px solid #e4e7ec",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 14, color: l.labelFg, flexShrink: 0 }}>{l.label}</div>
          {l.known && (
            <div
              className="a-ink"
              style={{
                fontSize: 14,
                color: "#101828",
                textAlign: "right",
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {l.value}
            </div>
          )}
          {l.active && <Dots />}
        </div>
      ))}
    </div>
  );
}
