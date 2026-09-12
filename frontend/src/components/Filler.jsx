// Filler stage: the forms list, the paper, the pen overlay, and the feed.

function Check({ size = 10 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="3.5"
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

function FormsList({ needed }) {
  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        background: "#ffffff",
        borderRight: "1px solid #e4e7ec",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "24px 24px 10px",
          fontSize: 13,
          fontWeight: 600,
          color: "#475467",
          letterSpacing: ".02em",
        }}
      >
        Forms
      </div>
      <div className="scroll" style={{ flex: 1, padding: "0 12px 20px" }}>
        {needed.map((p) => (
          <div
            key={p.id}
            className="row"
            onClick={p.onOpen}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              padding: "12px 12px",
              borderRadius: 10,
              background: p.bg,
              marginBottom: 2,
            }}
          >
            <div style={{ fontSize: "14.5px", fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ fontSize: 13, color: "#667085" }}>{p.agency}</div>
              <div
                className={p.pillClass}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: p.pillBg,
                  color: p.pillFg,
                }}
              >
                {p.pill}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PenOverlay({ strokes, pointerEvents, onPointerDown, onPointerMove, onPointerUp }) {
  return (
    <svg
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents,
        cursor: "crosshair",
        touchAction: "none",
      }}
    >
      {strokes.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#16264d"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function Field({ f, onStopEdit }) {
  return (
    <div
      style={{
        gridColumn: "span " + f.span,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div style={{ fontSize: 11, color: "#667085" }}>{f.label}</div>
      <div
        className={f.cls}
        onClick={f.onStartEdit}
        style={{
          minHeight: 26,
          borderBottom: "1px solid " + f.line,
          background: f.bg,
          padding: "3px 4px",
          display: "flex",
          alignItems: "flex-end",
          cursor: f.cursor,
          transition: "background .15s",
        }}
      >
        {f.editing && (
          <input
            ref={(el) => {
              if (el) el.focus();
            }}
            value={f.value}
            onChange={f.onEdit}
            onKeyDown={f.onEditKey}
            onBlur={onStopEdit}
            style={{
              width: "100%",
              border: 0,
              outline: 0,
              background: "transparent",
              fontSize: "13.5px",
              fontWeight: 500,
              color: "#101828",
              padding: 0,
            }}
          />
        )}
        {f.showValue && (
          <div
            className="a-ink"
            style={{ fontSize: "13.5px", color: "#101828", fontWeight: 500, lineHeight: 1.3 }}
          >
            {f.value}
          </div>
        )}
        {f.waiting && (
          <div style={{ fontSize: 12, color: "#9a6b0a", fontWeight: 600 }}>waiting on you</div>
        )}
      </div>
    </div>
  );
}

function Paper({ form, pen, strokes, penHandlers, signHint, signHintFg, onStopEdit }) {
  return (
    <div
      className="scroll"
      style={{ flex: 1, padding: "32px 36px 48px", display: "flex", justifyContent: "center" }}
    >
      <div className="a-rise" style={{ position: "relative", width: 612, alignSelf: "flex-start" }}>
        <div
          style={{
            minHeight: 792,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(16,24,40,.06), 0 16px 40px rgba(16,24,40,.12)",
            padding: "48px 52px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingBottom: 14,
              borderBottom: "2px solid #101828",
              marginBottom: 22,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "#667085",
                  marginBottom: 5,
                }}
              >
                {form.paperAgency}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.3px",
                  lineHeight: 1.2,
                }}
              >
                {form.paperTitle}
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#667085",
                textAlign: "right",
                lineHeight: 1.5,
                whiteSpace: "pre-line",
              }}
            >
              {form.paperRef}
            </div>
          </div>

          {form.sections.map((sec, si) => (
            <div key={si} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  paddingBottom: 6,
                  borderBottom: "1px solid #d0d5dd",
                  marginBottom: 10,
                }}
              >
                {sec.title}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px 20px",
                }}
              >
                {sec.fields.map((f) => (
                  <Field key={f.key} f={f} onStopEdit={onStopEdit} />
                ))}
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 11, color: "#667085" }}>Applicant signature</div>
              <div style={{ height: 40, borderBottom: "1px solid #101828" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 11, color: "#667085" }}>Date</div>
              <div style={{ height: 40, borderBottom: "1px solid #101828" }} />
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: signHintFg }}>{signHint}</div>
        </div>
        <PenOverlay
          strokes={strokes}
          pointerEvents={pen ? "auto" : "none"}
          onPointerDown={penHandlers.down}
          onPointerMove={penHandlers.move}
          onPointerUp={penHandlers.up}
        />
      </div>
    </div>
  );
}

function Feed({
  feedTitle,
  feedSub,
  feed,
  feedWorking,
  feedDone,
  hasAsk,
  ask,
  input,
  onInput,
  onKey,
  onSend,
  form,
}) {
  return (
    <div
      style={{
        width: 340,
        flexShrink: 0,
        background: "#ffffff",
        borderLeft: "1px solid #e4e7ec",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "24px 24px 14px", borderBottom: "1px solid #f2f4f7" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{feedTitle}</div>
        <div style={{ fontSize: "13.5px", color: "#667085", marginTop: 3, lineHeight: 1.45 }}>
          {feedSub}
        </div>
      </div>
      <div
        className="scroll"
        style={{
          flex: 1,
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {feed.map((e, i) => (
          <div key={i} className="a-slide" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              className="a-pop"
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: e.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {e.check && <Check />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{ fontSize: "14.5px", color: e.fg, fontWeight: e.weight, lineHeight: 1.4 }}
              >
                {e.text}
              </div>
              {e.hasSub && (
                <div style={{ fontSize: 13, color: "#98a2b3", lineHeight: 1.4 }}>{e.sub}</div>
              )}
            </div>
          </div>
        ))}
        {feedWorking && (
          <div
            className="a-fade"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: "#667085",
              paddingLeft: 4,
            }}
          >
            <Dots />
            <span>Filling from your details</span>
          </div>
        )}
      </div>
      {hasAsk && (
        <div className="a-rise" style={{ padding: "18px 24px 22px", borderTop: "1px solid #f2f4f7" }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>
            {ask.prompt}
          </div>
          <div
            style={{ fontSize: "13.5px", color: "#667085", marginBottom: 12, lineHeight: 1.45 }}
          >
            {ask.hint}
          </div>
          <div
            className="ask"
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              border: "1px solid #d0d5dd",
              borderRadius: 10,
              padding: "4px 4px 4px 12px",
              background: "#ffffff",
              transition: "border-color .15s",
            }}
          >
            <input
              value={input}
              onChange={onInput}
              onKeyDown={onKey}
              placeholder={ask.placeholder}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                fontSize: 15,
                background: "transparent",
                color: "#101828",
                minHeight: 38,
              }}
            />
            <button
              className="btn primary"
              onClick={onSend}
              style={{
                fontSize: "13.5px",
                fontWeight: 600,
                color: "#ffffff",
                background: "#1e4b9a",
                border: 0,
                borderRadius: 7,
                padding: "0 12px",
                height: 34,
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
      {feedDone && (
        <div className="a-rise" style={{ padding: "18px 24px 22px", borderTop: "1px solid #f2f4f7" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Ready to send</div>
          <div style={{ fontSize: 14, color: "#344054", lineHeight: 1.5 }}>{form.channel}</div>
          <div
            style={{ fontSize: "13.5px", color: "#667085", lineHeight: 1.5, marginTop: 10 }}
          >
            Still yours to add: {form.youAdd}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Filler({
  needed,
  form,
  pen,
  onTogglePen,
  penLabel,
  penBg,
  penFg,
  penBorder,
  hasInk,
  onClearInk,
  strokes,
  penHandlers,
  signHint,
  signHintFg,
  onStopEdit,
  feedTitle,
  feedSub,
  feed,
  feedWorking,
  feedDone,
  hasAsk,
  ask,
  input,
  onInput,
  onKey,
  onSend,
}) {
  return (
    <div className="a-assemble" style={{ flex: 1, display: "flex", minWidth: 0 }}>
      <FormsList needed={needed} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#e9ecf1",
        }}
      >
        <div
          style={{
            height: 60,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 32px",
            background: "#ffffff",
            borderBottom: "1px solid #e4e7ec",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{form.title}</div>
            <div style={{ fontSize: "13.5px", color: "#667085" }}>{form.sub}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn"
              onClick={onTogglePen}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: penFg,
                background: penBg,
                border: "1px solid " + penBorder,
                borderRadius: 9,
                padding: "0 14px",
                height: 38,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
              {penLabel}
            </button>
            {hasInk && (
              <button
                className="btn link"
                onClick={onClearInk}
                style={{
                  fontSize: "13.5px",
                  fontWeight: 500,
                  color: "#667085",
                  background: "transparent",
                  border: 0,
                  padding: "0 6px",
                  height: 38,
                }}
              >
                Clear ink
              </button>
            )}
            <div style={{ width: 1, height: 22, background: "#e4e7ec", margin: "0 2px" }} />
            <button
              className="btn ghost"
              onClick={form.onDownload}
              disabled={form.downloadDisabled}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1e4b9a",
                background: "#eaf0f9",
                border: 0,
                borderRadius: 9,
                padding: "0 16px",
                height: 38,
              }}
            >
              Download PDF
            </button>
            <button
              className="btn primary"
              onClick={form.onMarkSent}
              disabled={form.sentDisabled}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#ffffff",
                background: "#1e4b9a",
                border: 0,
                borderRadius: 9,
                padding: "0 16px",
                height: 38,
              }}
            >
              {form.sentLabel}
            </button>
          </div>
        </div>

        <Paper
          form={form}
          pen={pen}
          strokes={strokes}
          penHandlers={penHandlers}
          signHint={signHint}
          signHintFg={signHintFg}
          onStopEdit={onStopEdit}
        />
      </div>

      <Feed
        feedTitle={feedTitle}
        feedSub={feedSub}
        feed={feed}
        feedWorking={feedWorking}
        feedDone={feedDone}
        hasAsk={hasAsk}
        ask={ask}
        input={input}
        onInput={onInput}
        onKey={onKey}
        onSend={onSend}
        form={form}
      />
    </div>
  );
}
