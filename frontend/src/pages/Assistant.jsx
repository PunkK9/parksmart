import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Bot, Compass, HelpCircle, Info, Send, Sparkles, User, Zap } from "lucide-react";
import api, { errMsg } from "../api";
import { fmtHourShort } from "../utils";

const SUGGESTIONS = [
  "Any free slot in zone B?",
  "Is A3 free?",
  "When is the best time to arrive?",
  "What is the current fee for cars?",
  "Where is the entrance located?",
  "What's my usual slot?",
];

export default function Assistant() {
  const [log, setLog] = useState([
    {
      from: "bot",
      text: "Hi! Ask me which bays are free, when it's least busy, what parking costs, or how to find the gate.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [demand, setDemand] = useState([]);
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  useEffect(() => {
    api.get("/ai/prediction")
      .then((r) => {
        if (r.data?.counts) {
          setDemand(
            r.data.counts.map((c, h) => ({
              hour: fmtHourShort(h),
              bookings: c,
              trend: r.data.smoothed[h],
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const send = async (msg) => {
    const m = (msg ?? text).trim();
    if (!m || busy) return;
    setText("");
    setLog((l) => [...l, { from: "me", text: m }]);
    setBusy(true);
    try {
      const { data } = await api.post("/ai/chat", { message: m });
      setLog((l) => [...l, { from: "bot", text: data.reply }]);
    } catch (e) {
      setLog((l) => [...l, { from: "bot", text: errMsg(e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assistant</h1>
          <p>Ask about free bays, busy times, fees and your booking. Answers come from live booking data.</p>
        </div>
      </div>

      <div className="chat-layout">
        {/* Main Spatial Chat Panel */}
        <div className="card chat-panel" style={{ padding: 0 }}>
          <div className="chat-messages">
            {log.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  justifyContent: m.from === "me" ? "flex-end" : "flex-start",
                }}
              >
                {m.from === "bot" && (
                  <div className="ai-orb" style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
                    <Bot size={18} color="#ffffff" />
                  </div>
                )}

                <div className={`chat-bubble ${m.from === "me" ? "bubble-user" : "bubble-ai"}`}>
                  {m.text}
                </div>

                {m.from === "me" && (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--brand-soft)",
                      color: "var(--brand)",
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid var(--brand-border)",
                      flexShrink: 0,
                    }}
                  >
                    <User size={18} />
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="ai-orb" style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
                  <Sparkles size={16} color="#ffffff" className="spin" />
                </div>
                <div className="chat-bubble bubble-ai muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Thinking…
                </div>
              </div>
            )}
            <div ref={end} />
          </div>

          {/* Suggested Intent Chips */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--surface-glass)" }}>
            <div className="intent-chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="intent-chip"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input Bar */}
          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask anything (e.g. 'Is bay A2 available?', 'Best time to arrive?')"
              aria-label="Message to the assistant"
            />
            <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Send query">
              <Send size={15} />
            </button>
          </form>
        </div>

        {/* Spatial Intelligence Side Widget */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={16} color="var(--brand)" /> Demand by hour
            </h3>
            <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
              Bookings per hour, which sets the fee:
            </p>

            <div style={{ height: 160, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={demand} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aiCurve" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={3} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(14, 21, 38, 0.9)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#aiCurve)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Info size={15} color="var(--brand)" /> What you can ask
            </h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
              <li>Live bay availability check</li>
              <li>Best time to arrive</li>
              <li>Current fee and peak pricing</li>
              <li>Where the gate is</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
