// What the city needs for this event, from POST /api/determine.

export default function Summary({
  eventTitle,
  head,
  sub,
  siteCheck,
  feeFixed,
  feeVariable,
  rows,
  tailDelay,
  notNeededLine,
  showNotNeeded,
  onToggleNotNeeded,
  notNeeded,
  onFillAll,
}) {
  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "72px 48px 80px" }}>
        <div
          className="a-rise"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#475467",
            letterSpacing: ".02em",
            marginBottom: 14,
          }}
        >
          {eventTitle}
        </div>
        <div
          className="a-rise"
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-1.2px",
            lineHeight: 1.08,
            marginBottom: 16,
            animationDelay: "60ms",
          }}
        >
          {head}
        </div>
        <div
          className="a-rise"
          style={{
            fontSize: 17,
            color: "#475467",
            lineHeight: 1.5,
            maxWidth: 620,
            marginBottom: 40,
            animationDelay: "120ms",
          }}
        >
          {sub}
        </div>

        <div
          className="a-rise"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 200px",
            gap: 32,
            padding: "20px 24px",
            border: "1px solid #dfe3ea",
            borderRadius: 12,
            background: "#ffffff",
            marginBottom: 14,
            animationDelay: "200ms",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{siteCheck.title}</div>
            <div style={{ fontSize: 15, color: "#344054", lineHeight: 1.5 }}>{siteCheck.text}</div>
            <div style={{ fontSize: 13, color: "#98a2b3", marginTop: 2 }}>{siteCheck.source}</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
              borderLeft: "1px solid #e4e7ec",
              paddingLeft: 24,
            }}
          >
            <div style={{ fontSize: 13, color: "#667085" }}>Fees for this event</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.4px" }}>{feeFixed}</div>
            <div style={{ fontSize: 13, color: "#667085", lineHeight: 1.4 }}>{feeVariable}</div>
          </div>
        </div>

        {rows.map((r) => (
          <div
            key={r.id}
            className="a-rise"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px",
              gap: 32,
              padding: "22px 24px",
              border: "1px solid #dfe3ea",
              borderRadius: 12,
              background: "#ffffff",
              marginBottom: 10,
              animationDelay: r.delay,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.2px" }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 14, color: "#667085" }}>{r.agency}</div>
              </div>
              <div style={{ fontSize: 15, color: "#344054", lineHeight: 1.5, maxWidth: 560 }}>
                {r.purpose}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr",
                  gap: "4px 16px",
                  marginTop: 8,
                  fontSize: 14,
                }}
              >
                <div style={{ color: "#667085" }}>Due</div>
                <div style={{ color: r.dueFg, fontWeight: 500 }}>{r.due}</div>
                <div style={{ color: "#667085" }}>Fee</div>
                <div style={{ color: "#101828", fontWeight: 500 }}>{r.fee}</div>
                <div style={{ color: "#667085" }}>Limits</div>
                <div style={{ color: "#344054", lineHeight: 1.45 }}>{r.limits}</div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "stretch",
                justifyContent: "center",
              }}
            >
              <button
                className="btn primary"
                onClick={r.onFill}
                style={{
                  fontSize: "14.5px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "#1e4b9a",
                  border: 0,
                  borderRadius: 10,
                  height: 42,
                }}
              >
                {r.fillLabel}
              </button>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1e4b9a",
                  textAlign: "center",
                  padding: "8px 0",
                }}
              >
                {r.linkLabel}
              </a>
            </div>
          </div>
        ))}

        <div
          className="a-rise"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "22px 0 0",
            animationDelay: tailDelay,
          }}
        >
          <button
            className="btn link"
            onClick={onToggleNotNeeded}
            style={{
              fontSize: 14,
              color: "#667085",
              background: "transparent",
              border: 0,
              padding: 0,
            }}
          >
            {notNeededLine}
          </button>
          <button
            className="btn primary"
            onClick={onFillAll}
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#ffffff",
              background: "#12305e",
              border: 0,
              borderRadius: 10,
              padding: "0 22px",
              height: 46,
            }}
          >
            Fill everything for me
          </button>
        </div>

        {showNotNeeded && (
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0 40px",
            }}
          >
            {notNeeded.map((n) => (
              <div
                key={n.id}
                className="a-fade"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "9px 0",
                  borderBottom: "1px solid #e4e7ec",
                  animationDelay: n.delay,
                }}
              >
                <div style={{ fontSize: 14, color: "#475467" }}>{n.name}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#98a2b3",
                    textAlign: "right",
                    maxWidth: 200,
                    lineHeight: 1.4,
                  }}
                >
                  {n.why}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
