// Chat intake: transcript, animated action log, suggestion chips, composer.

function Check({ size = 9, stroke = "#ffffff", width = 3.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Dots() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <div className="dot" />
      <div className="dot dot2" />
      <div className="dot dot3" />
    </div>
  );
}

function Message({ m }) {
  return (
    <div
      className="a-rise"
      style={{ display: "flex", flexDirection: "column", alignItems: m.align, gap: 8 }}
    >
      {m.isAgent && (
        <div
          style={{
            fontSize: m.size,
            fontWeight: m.weight,
            color: m.fg,
            lineHeight: m.lh,
            letterSpacing: m.tracking,
            maxWidth: 600,
            whiteSpace: "pre-line",
          }}
        >
          {m.text}
        </div>
      )}
      {m.isUser && (
        <div
          style={{
            fontSize: "15.5px",
            fontWeight: 500,
            color: "#12305e",
            background: "#e6edf8",
            padding: "10px 14px",
            borderRadius: "12px 12px 3px 12px",
            maxWidth: 480,
            lineHeight: 1.45,
          }}
        >
          {m.text}
        </div>
      )}
      {m.isActions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingLeft: 2 }}>
          {m.actions.map((a, i) => (
            <div
              key={i}
              className="a-slide"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "14.5px",
                color: "#475467",
                animationDelay: a.delay,
              }}
            >
              <div
                className="a-pop"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: a.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  animationDelay: a.delay,
                }}
              >
                <Check />
              </div>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Intake({
  chat,
  thinking,
  thinkingText,
  chips,
  input,
  onInput,
  onKey,
  onSend,
  placeholder,
  showExample,
  onExample,
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div className="scroll" style={{ flex: 1, padding: "64px 0 24px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            margin: "0 auto",
            padding: "0 48px",
            display: "flex",
            flexDirection: "column",
            gap: 26,
          }}
        >
          {chat.map((m, i) => (
            <Message key={i} m={m} />
          ))}
          {thinking && (
            <div
              className="a-fade"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "14.5px",
                color: "#667085",
              }}
            >
              <Dots />
              <span>{thinkingText}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "8px 0 36px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 48px" }}>
          {chips.length > 0 && (
            <div
              className="a-fade"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
                paddingLeft: 4,
              }}
            >
              {chips.map((c, i) => (
                <button
                  key={i}
                  className="sug"
                  onClick={c.pick}
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 500,
                    color: "#475467",
                    background: "transparent",
                    border: 0,
                    borderRadius: 6,
                    padding: "5px 9px",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div
            className="composer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 16,
              padding: "8px 8px 8px 22px",
              background: "#ffffff",
            }}
          >
            <input
              value={input}
              onChange={onInput}
              onKeyDown={onKey}
              placeholder={placeholder}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                fontSize: 17,
                background: "transparent",
                color: "#101828",
                minHeight: 48,
              }}
            />
            {showExample && (
              <button
                className="btn link"
                onClick={onExample}
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#667085",
                  background: "transparent",
                  border: 0,
                  padding: "0 10px",
                  height: 44,
                }}
              >
                Use an example
              </button>
            )}
            <button
              className="btn primary"
              onClick={onSend}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#1e4b9a",
                border: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
