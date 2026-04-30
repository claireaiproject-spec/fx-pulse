import { useState, useEffect, useCallback, useRef } from "react";
import { Analytics } from '@vercel/analytics/react';

const PAIRS = [
  { from: "USD", to: "EUR", flag1: "🇺🇸", flag2: "🇪🇺" },
  { from: "USD", to: "GBP", flag1: "🇺🇸", flag2: "🇬🇧" },
  { from: "USD", to: "JPY", flag1: "🇺🇸", flag2: "🇯🇵" },
  { from: "EUR", to: "GBP", flag1: "🇪🇺", flag2: "🇬🇧" },
  { from: "GBP", to: "JPY", flag1: "🇬🇧", flag2: "🇯🇵" },
  { from: "USD", to: "CAD", flag1: "🇺🇸", flag2: "🇨🇦" },
  { from: "USD", to: "AUD", flag1: "🇺🇸", flag2: "🇦🇺" },
  { from: "EUR", to: "JPY", flag1: "🇪🇺", flag2: "🇯🇵" },
];

const BANKING_APPS = [
  { id: "wise", name: "Wise", color: "#00B9A9", icon: "W", desc: "Send money abroad" },
  { id: "revolut", name: "Revolut", color: "#0075EB", icon: "R", desc: "Exchange & spend" },
  { id: "paypal", name: "PayPal", color: "#003087", icon: "P", desc: "International payments" },
  { id: "transfergo", name: "TransferGo", color: "#FF4B4B", icon: "T", desc: "Fast transfers" },
];

const BASE_RATES = {
  "USD-EUR": 0.9231, "USD-GBP": 0.7842, "USD-JPY": 149.82,
  "EUR-GBP": 0.8494, "GBP-JPY": 191.05, "USD-CAD": 1.3621,
  "USD-AUD": 1.5234, "EUR-JPY": 162.31,
};

function generateHistory(base, points = 24) {
  return Array.from({ length: points }, (_, i) => ({
    time: i,
    rate: base * (1 + (Math.random() - 0.5) * 0.02),
  }));
}

function Sparkline({ data, color, width = 120, height = 36 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => d.rate);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const trend = vals[vals.length - 1] > vals[0] ? "#22c55e" : "#ef4444";
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trend} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={`url(#g-${color})`}
      />
      <polyline points={pts.join(" ")} fill="none" stroke={trend} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [rates, setRates] = useState({});
  const [history, setHistory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedPair, setSelectedPair] = useState(null);
  const [alertForm, setAlertForm] = useState({ pair: "USD-EUR", type: "below", value: "" });
  const [conversion, setConversion] = useState({ amount: "", from: "USD", to: "EUR", result: null });
  const [permissions, setPermissions] = useState({});
  const [view, setView] = useState("rates"); // rates | alerts | convert | banking
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState(0);
  const notifRef = useRef([]);

  // Simulate live rates
  useEffect(() => {
    const init = {};
    const hist = {};
    PAIRS.forEach(({ from, to }) => {
      const key = `${from}-${to}`;
      init[key] = BASE_RATES[key];
      hist[key] = generateHistory(BASE_RATES[key]);
    });
    setRates(init);
    setHistory(hist);
    setLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRates((prev) => {
        const updated = {};
        Object.entries(prev).forEach(([k, v]) => {
          updated[k] = parseFloat((v * (1 + (Math.random() - 0.499) * 0.003)).toFixed(6));
        });
        return updated;
      });
      setHistory((prev) => {
        const updated = {};
        Object.entries(prev).forEach(([k, v]) => {
          const last = v[v.length - 1];
          const newRate = last.rate * (1 + (Math.random() - 0.499) * 0.003);
          updated[k] = [...v.slice(-23), { time: last.time + 1, rate: newRate }];
        });
        return updated;
      });
      setTicker((t) => t + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Check alerts
  useEffect(() => {
    if (!alerts.length) return;
    alerts.forEach((alert) => {
      const current = rates[alert.pair];
      if (!current) return;
      const triggered =
        (alert.type === "below" && current <= alert.value) ||
        (alert.type === "above" && current >= alert.value);
      if (triggered && !alert.fired) {
        const msg = `🔔 ${alert.pair} hit ${current.toFixed(4)} (target: ${alert.value})`;
        setNotifications((n) => [{ id: Date.now(), msg, time: new Date().toLocaleTimeString() }, ...n.slice(0, 4)]);
        setAlerts((a) => a.map((al) => al.id === alert.id ? { ...al, fired: true } : al));
      }
    });
  }, [rates, alerts]);

  const addAlert = () => {
    if (!alertForm.value) return;
    setAlerts((a) => [
      ...a,
      { id: Date.now(), ...alertForm, value: parseFloat(alertForm.value), fired: false },
    ]);
    setAlertForm((f) => ({ ...f, value: "" }));
  };

  const doConvert = () => {
    const key = `${conversion.from}-${conversion.to}`;
    const reverseKey = `${conversion.to}-${conversion.from}`;
    let rate = rates[key] || (rates[reverseKey] ? 1 / rates[reverseKey] : null);
    if (!rate || !conversion.amount) return;
    setConversion((c) => ({ ...c, result: (parseFloat(c.amount) * rate).toFixed(4), rate }));
  };

  const grantPermission = (appId) => {
    setPermissions((p) => ({ ...p, [appId]: true }));
    setNotifications((n) => [{ id: Date.now(), msg: `✅ Permission granted to ${appId}`, time: new Date().toLocaleTimeString() }, ...n.slice(0, 4)]);
  };

  const revokePermission = (appId) => {
    setPermissions((p) => ({ ...p, [appId]: false }));
  };

  const executeTransfer = (app) => {
    if (!permissions[app.id]) return;
    const { amount, from, to, rate } = conversion;
    if (!amount || !rate) return;
    const result = (parseFloat(amount) * rate).toFixed(4);
    setNotifications((n) => [
      { id: Date.now(), msg: `💸 ${app.name}: Sending ${amount} ${from} → ${result} ${to}`, time: new Date().toLocaleTimeString() },
      ...n.slice(0, 4),
    ]);
  };

  const allCurrencies = [...new Set(PAIRS.flatMap(({ from, to }) => [from, to]))];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      color: "#e8edf5",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d1320; } ::-webkit-scrollbar-thumb { background: #2a3448; border-radius: 4px; }
        input, select { background: #0d1320; color: #e8edf5; border: 1px solid #1e2a3a; border-radius: 8px; padding: 10px 14px; font-family: inherit; font-size: 14px; outline: none; transition: border-color .2s; }
        input:focus, select:focus { border-color: #3b82f6; }
        .btn { cursor: pointer; border: none; border-radius: 8px; font-family: inherit; font-weight: 500; transition: all .15s; }
        .btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .btn:active { transform: translateY(0); }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .fade-in { animation: fadeIn .4s ease; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .notif-enter { animation: slideIn .3s ease; }
        @keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
        .rate-tick { animation: tick .3s ease; }
        @keyframes tick { 0% { background: rgba(59,130,246,0.15); } 100% { background: transparent; } }
        .nav-tab { padding: 8px 18px; border-radius: 8px; border: none; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .2s; }
        .nav-tab.active { background: #1e40af; color: #fff; }
        .nav-tab:not(.active) { background: transparent; color: #6b7a96; }
        .nav-tab:not(.active):hover { color: #e8edf5; background: #0d1320; }
        .card { background: #0d1320; border: 1px solid #1a2235; border-radius: 14px; padding: 18px; transition: border-color .2s; }
        .card:hover { border-color: #2a3a58; }
        .tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; letter-spacing: .05em; text-transform: uppercase; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a2235", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080c14", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #1d4ed8, #7c3aed)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>₿</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>FX Pulse</div>
            <div style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>
              <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#22c55e", marginRight: 5 }} />
              LIVE · {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {notifications.length > 0 && (
            <div style={{ maxWidth: 260, overflow: "hidden" }}>
              <div className="notif-enter" style={{ background: "#0f2040", border: "1px solid #1e3a60", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#93c5fd" }}>
                {notifications[0].msg}
              </div>
            </div>
          )}
          <div style={{ position: "relative" }}>
            <button className="btn" style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "7px 10px", borderRadius: 8, fontSize: 16 }}>🔔</button>
            {notifications.length > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                {notifications.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 4, padding: "12px 24px", borderBottom: "1px solid #1a2235" }}>
        {[
          { id: "rates", label: "📈 Live Rates" },
          { id: "alerts", label: "🎯 Alerts" },
          { id: "convert", label: "🔄 Convert" },
          { id: "banking", label: "🏦 Banking" },
        ].map(({ id, label }) => (
          <button key={id} className={`nav-tab ${view === id ? "active" : ""}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px 24px", maxWidth: 900, width: "100%", margin: "0 auto" }} className="fade-in">

        {/* RATES VIEW */}
        {view === "rates" && (
          <div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>Exchange Rates</h2>
              <span style={{ fontSize: 12, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>Updates every 3s</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {PAIRS.map(({ from, to, flag1, flag2 }) => {
                const key = `${from}-${to}`;
                const rate = rates[key];
                const hist = history[key] || [];
                const prev = hist.length > 1 ? hist[hist.length - 2]?.rate : rate;
                const change = rate && prev ? ((rate - prev) / prev * 100) : 0;
                const up = change >= 0;
                return (
                  <div key={key} className="card" style={{ cursor: "pointer", position: "relative" }}
                    onClick={() => setSelectedPair(selectedPair === key ? null : key)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#6b7a96", marginBottom: 4 }}>
                          {flag1} {from} <span style={{ color: "#2a3448" }}>→</span> {flag2} {to}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>
                          {rate ? rate.toFixed(4) : "—"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Sparkline data={hist} color={key} />
                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: up ? "#22c55e" : "#ef4444", marginTop: 4 }}>
                          {up ? "▲" : "▼"} {Math.abs(change).toFixed(3)}%
                        </div>
                      </div>
                    </div>
                    {selectedPair === key && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a2235", display: "flex", gap: 8 }}>
                        <button className="btn" style={{ flex: 1, background: "#1e3a60", color: "#93c5fd", padding: "8px", fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); setAlertForm({ ...alertForm, pair: key }); setView("alerts"); }}>
                          + Set Alert
                        </button>
                        <button className="btn" style={{ flex: 1, background: "#1a2a1a", color: "#86efac", padding: "8px", fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); setConversion({ ...conversion, from, to }); setView("convert"); }}>
                          Convert
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ALERTS VIEW */}
        {view === "alerts" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Rate Alerts</h2>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "#6b7a96", textTransform: "uppercase", letterSpacing: ".05em" }}>New Alert</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select value={alertForm.pair} onChange={(e) => setAlertForm({ ...alertForm, pair: e.target.value })} style={{ flex: "1 1 140px" }}>
                  {PAIRS.map(({ from, to }) => <option key={`${from}-${to}`} value={`${from}-${to}`}>{from} / {to}</option>)}
                </select>
                <select value={alertForm.type} onChange={(e) => setAlertForm({ ...alertForm, type: e.target.value })} style={{ flex: "1 1 120px" }}>
                  <option value="below">Falls Below</option>
                  <option value="above">Rises Above</option>
                </select>
                <input
                  type="number" placeholder="Rate value" value={alertForm.value}
                  onChange={(e) => setAlertForm({ ...alertForm, value: e.target.value })}
                  style={{ flex: "1 1 120px" }}
                />
                <button className="btn" onClick={addAlert} style={{ background: "#1d4ed8", color: "#fff", padding: "10px 20px", fontSize: 14 }}>
                  + Add Alert
                </button>
              </div>
              {alertForm.pair && rates[alertForm.pair] && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#4a5568" }}>
                  Current rate: <span style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace" }}>{rates[alertForm.pair]?.toFixed(4)}</span>
                </div>
              )}
            </div>

            {alerts.length === 0 ? (
              <div style={{ textAlign: "center", color: "#2a3448", padding: "48px 0", fontSize: 14 }}>No alerts set yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map((alert) => {
                  const current = rates[alert.pair];
                  const triggered = alert.fired;
                  return (
                    <div key={alert.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: triggered ? 0.6 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 20 }}>{triggered ? "✅" : "⏳"}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {alert.pair} {alert.type === "below" ? "↘ below" : "↗ above"}{" "}
                            <span style={{ fontFamily: "'DM Mono', monospace", color: "#93c5fd" }}>{alert.value}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>
                            Current: <span style={{ fontFamily: "'DM Mono', monospace", color: current >= alert.value ? "#22c55e" : "#ef4444" }}>{current?.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="tag" style={{ background: triggered ? "#1a2f1a" : "#1a2040", color: triggered ? "#86efac" : "#93c5fd" }}>
                          {triggered ? "FIRED" : "ACTIVE"}
                        </span>
                        <button className="btn" onClick={() => setAlerts((a) => a.filter((al) => al.id !== alert.id))}
                          style={{ background: "#2a1a1a", color: "#ef4444", padding: "6px 12px", fontSize: 12 }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {notifications.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7a96", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Recent Notifications</div>
                {notifications.map((n) => (
                  <div key={n.id} className="notif-enter card" style={{ marginBottom: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "#1e3a60" }}>
                    <span>{n.msg}</span>
                    <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono', monospace" }}>{n.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONVERT VIEW */}
        {view === "convert" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Currency Converter</h2>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 140px" }}>
                  <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>Amount</div>
                  <input type="number" placeholder="0.00" value={conversion.amount}
                    onChange={(e) => setConversion({ ...conversion, amount: e.target.value, result: null })} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>From</div>
                  <select value={conversion.from} onChange={(e) => setConversion({ ...conversion, from: e.target.value, result: null })}>
                    {allCurrencies.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <button className="btn" style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "10px 14px", fontSize: 18, marginBottom: 0 }}
                  onClick={() => setConversion((c) => ({ ...c, from: c.to, to: c.from, result: null }))}>⇄</button>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>To</div>
                  <select value={conversion.to} onChange={(e) => setConversion({ ...conversion, to: e.target.value, result: null })}>
                    {allCurrencies.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <button className="btn" onClick={doConvert} style={{ background: "#1d4ed8", color: "#fff", padding: "10px 24px", fontSize: 14, flex: "0 0 auto" }}>
                  Convert
                </button>
              </div>
              {conversion.result && (
                <div style={{ marginTop: 20, padding: "16px", background: "#060a12", borderRadius: 10, border: "1px solid #1e3a60" }}>
                  <div style={{ fontSize: 13, color: "#6b7a96", marginBottom: 6 }}>Result</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>
                    <span style={{ color: "#e8edf5" }}>{conversion.amount} {conversion.from}</span>
                    <span style={{ color: "#2a3448", margin: "0 12px" }}>=</span>
                    <span style={{ color: "#22c55e" }}>{conversion.result} {conversion.to}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#4a5568", marginTop: 8, fontFamily: "'DM Mono', monospace" }}>
                    Rate: 1 {conversion.from} = {conversion.rate?.toFixed(6)} {conversion.to}
                  </div>
                  <button className="btn" onClick={() => setView("banking")} style={{ marginTop: 14, background: "#1a2f1a", color: "#86efac", padding: "8px 18px", fontSize: 13 }}>
                    Execute via Banking App →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BANKING VIEW */}
        {view === "banking" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Banking Integrations</h2>
            <p style={{ fontSize: 13, color: "#4a5568", marginBottom: 20 }}>
              Grant permission to execute conversions directly via partner apps.
            </p>

            {!conversion.result && (
              <div style={{ background: "#0d1320", border: "1px solid #2a3448", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#6b7a96" }}>
                💡 Set up a conversion first in the <button className="btn" onClick={() => setView("convert")} style={{ background: "none", color: "#93c5fd", textDecoration: "underline", padding: 0, fontSize: 13 }}>Convert tab</button> to execute via banking apps.
              </div>
            )}

            {conversion.result && (
              <div style={{ background: "#0a1a10", border: "1px solid #1a3a20", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#4a5568", marginBottom: 2 }}>Ready to execute</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 15 }}>
                    {conversion.amount} {conversion.from} → <span style={{ color: "#22c55e" }}>{conversion.result} {conversion.to}</span>
                  </div>
                </div>
                <span className="tag" style={{ background: "#1a3a20", color: "#86efac" }}>READY</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {BANKING_APPS.map((app) => {
                const granted = permissions[app.id];
                return (
                  <div key={app.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: app.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                        {app.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{app.name}</div>
                        <div style={{ fontSize: 12, color: "#4a5568" }}>{app.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {granted ? (
                        <>
                          <span className="tag" style={{ background: "#1a2f1a", color: "#86efac" }}>PERMITTED</span>
                          {conversion.result && (
                            <button className="btn" onClick={() => executeTransfer(app)}
                              style={{ background: app.color, color: "#fff", padding: "8px 16px", fontSize: 13 }}>
                              Send
                            </button>
                          )}
                          <button className="btn" onClick={() => revokePermission(app.id)}
                            style={{ background: "#2a1a1a", color: "#ef4444", padding: "8px 12px", fontSize: 12 }}>
                            Revoke
                          </button>
                        </>
                      ) : (
                        <button className="btn" onClick={() => grantPermission(app.id)}
                          style={{ background: "#0f1e36", border: "1px solid #1d4ed8", color: "#93c5fd", padding: "8px 16px", fontSize: 13 }}>
                          Grant Access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, padding: "14px 16px", background: "#0d1018", borderRadius: 10, border: "1px solid #1a2235", fontSize: 12, color: "#4a5568", lineHeight: 1.7 }}>
              🔒 <strong style={{ color: "#6b7a96" }}>Privacy Notice:</strong> Granting access authorizes FX Pulse to initiate a single transfer on your behalf. No credentials are stored. You may revoke access at any time. All transfers require your explicit confirmation per session.
            </div>
          </div>
        )}
      </div>
      <Analytics />
    </div>
  );
}
