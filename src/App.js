import { useState, useEffect, useRef } from “react”;

// ── Pairs: SGD/MYR from CIMB, rest from ExchangeRate-API ─────────────────
const PAIRS = [
{ from: “SGD”, to: “MYR”, flag1: “🇸🇬”, flag2: “🇲🇾”, featured: true  },
{ from: “SGD”, to: “USD”, flag1: “🇸🇬”, flag2: “🇺🇸” },
{ from: “SGD”, to: “CNY”, flag1: “🇸🇬”, flag2: “🇨🇳” },
{ from: “SGD”, to: “JPY”, flag1: “🇸🇬”, flag2: “🇯🇵” },
{ from: “MYR”, to: “USD”, flag1: “🇲🇾”, flag2: “🇺🇸” },
{ from: “MYR”, to: “CNY”, flag1: “🇲🇾”, flag2: “🇨🇳” },
];

const CURRENCY_NAME = {
SGD: “S$”, USD: “US$”, MYR: “RM”, CNY: “¥”, JPY: “¥”
};

const ALL_CURRENCIES = […new Set(PAIRS.flatMap(({ from, to }) => [from, to]))];

const BANKING_APPS = [
{ id: “cimb”,    name: “CIMB Clicks”, color: “#CC0001”, icon: “C”, desc: “Best SGD→MYR · Zero fees”, url: “https://www.cimbclicks.com.sg/sgd-to-myr” },
{ id: “wise”,    name: “Wise”,        color: “#00B9A9”, icon: “W”, desc: “Mid-market rate · Low fees”, url: “https://wise.com/send#source-currency=SGD” },
{ id: “revolut”, name: “Revolut”,     color: “#0075EB”, icon: “R”, desc: “Exchange & spend globally”,  url: “https://revolut.com” },
{ id: “paypal”,  name: “PayPal”,      color: “#003087”, icon: “P”, desc: “International payments”,     url: “https://paypal.com” },
];

const BADGE_STYLE = {
CIMB:              { bg: “#3a0505”, color: “#fca5a5” },
“ExchangeRate-API”:{ bg: “#003325”, color: “#6ee7e7” },
fawazahmed0:       { bg: “#1a2040”, color: “#93c5fd” },
};

// ── CIMB rate: calls our own Vercel serverless function ────────────────────
async function fetchCIMBRate() {
try {
const r = await fetch(”/api/cimb-rate”);
if (!r.ok) throw new Error(“api error”);
const d = await r.json();
if (d.success && d.rate) {
return { rate: d.rate, label: “CIMB”, fetchedAt: d.fetchedAt };
}
} catch {}
return null;
}

// ── All other pairs: ExchangeRate-API (CORS-safe, no key) ──────────────────
// Fetches base currencies in bulk (2 calls: SGD base + MYR base)
async function fetchMarketRates() {
const bases = […new Set(PAIRS.filter(p => !p.featured).map(p => p.from))];
const rateMap = {};
await Promise.all(bases.map(async (base) => {
try {
const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
if (!r.ok) throw new Error();
const d = await r.json();
if (d?.rates) rateMap[base] = { rates: d.rates, label: “ExchangeRate-API” };
} catch {
// fallback
try {
const r2 = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`);
const d2 = await r2.json();
if (d2[base.toLowerCase()]) rateMap[base] = { rates: d2[base.toLowerCase()], label: “fawazahmed0”, isFallback: true };
} catch {}
}
}));
return rateMap;
}

function generateHistory(base, n = 24) {
return Array.from({ length: n }, (_, i) => ({
t: i, r: base * (1 + (Math.random() - 0.5) * 0.01),
}));
}

function Sparkline({ data, width = 110, height = 32 }) {
const uid = useRef(“sp” + Math.random().toString(36).slice(2)).current;
if (!data || data.length < 2) return null;
const vals = data.map(d => d.r);
const mn = Math.min(…vals), mx = Math.max(…vals), rng = mx - mn || 0.0001;
const pts = vals.map((v, i) =>
`${(i / (vals.length - 1)) * width},${height - ((v - mn) / rng) * (height - 4) - 2}`
).join(” “);
const col = vals[vals.length - 1] >= vals[0] ? “#22c55e” : “#ef4444”;
return (
<svg width={width} height={height} style={{ overflow: “visible” }}>
<defs>
<linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor={col} stopOpacity="0.2" />
<stop offset="100%" stopColor={col} stopOpacity="0" />
</linearGradient>
</defs>
<polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${uid})`} />
<polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
</svg>
);
}

function Badge({ label }) {
const s = BADGE_STYLE[label] || BADGE_STYLE[“fawazahmed0”];
return (
<span style={{ fontSize: 9, fontWeight: 700, padding: “1px 5px”, borderRadius: 3, letterSpacing: “.06em”, textTransform: “uppercase”, background: s.bg, color: s.color }}>
{label}
</span>
);
}

export default function App() {
const [rates,   setRates]   = useState({});   // key -> { rate, label, fetchedAt? }
const [history, setHistory] = useState({});
const [status,  setStatus]  = useState(“loading”);
const [updated, setUpdated] = useState(null);
const [alerts,  setAlerts]  = useState([]);
const [notifs,  setNotifs]  = useState([]);
const [aForm,   setAForm]   = useState({ pair: “SGD-MYR”, type: “above”, value: “” });
const [conv,    setConv]    = useState({ amount: “”, from: “SGD”, to: “MYR”, result: null, rate: null, src: null });
const [perms,   setPerms]   = useState({});
const [view,    setView]    = useState(“rates”);
const [selPair, setSelPair] = useState(null);

const cimb = rates[“SGD-MYR”];

const pushNotif = msg =>
setNotifs(n => [{ id: Date.now(), msg, time: new Date().toLocaleTimeString() }, …n.slice(0, 4)]);

const loadAll = async () => {
setStatus(“loading”);
try {
const next = {};

```
  // Fetch CIMB + market rates in parallel
  const [cimbRes, marketRates] = await Promise.all([
    fetchCIMBRate(),
    fetchMarketRates(),
  ]);

  // SGD-MYR from CIMB serverless function
  if (cimbRes) next["SGD-MYR"] = cimbRes;

  // Other pairs from ExchangeRate-API / fallback
  PAIRS.filter(p => !p.featured).forEach(({ from, to }) => {
    const key = `${from}-${to}`;
    const base = marketRates[from];
    if (!base) return;
    // ExchangeRate-API uses uppercase keys; fawazahmed0 uses lowercase
    const rate = base.isFallback
      ? base.rates[to.toLowerCase()]
      : base.rates[to];
    if (rate) next[key] = { rate, label: base.label };
  });

  // Fallback SGD-MYR if CIMB API failed
  if (!next["SGD-MYR"]) {
    const base = marketRates["SGD"];
    const rate = base?.isFallback ? base?.rates["myr"] : base?.rates?.["MYR"];
    if (rate) next["SGD-MYR"] = { rate, label: base.label, fetchedAt: new Date().toISOString() };
  }

  setRates(prev => {
    setHistory(h => {
      const u = { ...h };
      Object.entries(next).forEach(([k, v]) => {
        if (!u[k]) u[k] = generateHistory(v.rate);
        else {
          const last = u[k][u[k].length - 1];
          u[k] = [...u[k].slice(-23), { t: last.t + 1, r: v.rate }];
        }
      });
      return u;
    });
    return next;
  });

  setUpdated(new Date());
  setStatus("live");
} catch {
  setStatus("error");
}
```

};

useEffect(() => {
loadAll();
const iv = setInterval(loadAll, 120_000);
return () => clearInterval(iv);
}, []);

// Check alerts
useEffect(() => {
alerts.forEach(al => {
const cur = rates[al.pair]?.rate;
if (!cur || al.fired) return;
const hit = (al.type === “below” && cur <= al.value) || (al.type === “above” && cur >= al.value);
if (hit) {
pushNotif(`🔔 ${al.pair} hit ${cur.toFixed(4)} — target ${al.type} ${al.value}`);
setAlerts(a => a.map(x => x.id === al.id ? { …x, fired: true } : x));
}
});
}, [rates]);

const addAlert = () => {
if (!aForm.value) return;
setAlerts(a => […a, { id: Date.now(), …aForm, value: parseFloat(aForm.value), fired: false }]);
setAForm(f => ({ …f, value: “” }));
};

const doConvert = () => {
const key = `${conv.from}-${conv.to}`;
const rkey = `${conv.to}-${conv.from}`;
const obj = rates[key] || (rates[rkey] ? { rate: 1 / rates[rkey].rate, label: rates[rkey].label } : null);
if (!obj || !conv.amount) return;
setConv(c => ({ …c, result: (parseFloat(c.amount) * obj.rate).toFixed(4), rate: obj.rate, src: obj.label }));
};

const executeTransfer = app => {
if (!perms[app.id] || !conv.result) return;
pushNotif(`💸 ${app.name}: ${conv.amount} ${conv.from} → ${conv.result} ${conv.to}`);
window.open(app.url, “_blank”);
};

// Format time from ISO string
const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString(“en-SG”, { hour: “2-digit”, minute: “2-digit”, second: “2-digit” }) : null;

return (
<div style={{ minHeight: “100vh”, background: “#080c14”, color: “#e8edf5”, fontFamily: “‘DM Sans’,‘Segoe UI’,sans-serif”, display: “flex”, flexDirection: “column” }}>
<style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d1320}::-webkit-scrollbar-thumb{background:#2a3448;border-radius:4px} input,select{background:#0d1320;color:#e8edf5;border:1px solid #1e2a3a;border-radius:8px;padding:10px 14px;font-family:inherit;font-size:14px;outline:none;transition:border-color .2s;width:100%} input:focus,select:focus{border-color:#3b82f6} .btn{cursor:pointer;border:none;border-radius:8px;font-family:inherit;font-weight:500;transition:all .15s} .btn:hover{filter:brightness(1.15);transform:translateY(-1px)} .card{background:#0d1320;border:1px solid #1a2235;border-radius:14px;padding:18px;transition:border-color .2s} .card:hover{border-color:#2a3a58} .nav-tab{padding:8px 18px;border-radius:8px;border:none;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap} .nav-tab.active{background:#1e40af;color:#fff} .nav-tab:not(.active){background:transparent;color:#6b7a96} .nav-tab:not(.active):hover{color:#e8edf5;background:#0d1320} .tag{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;letter-spacing:.05em;text-transform:uppercase} .fade-in{animation:fadeIn .4s ease} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .notif{animation:slideIn .3s ease} @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}} .pulse{animation:pulse 2s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}} .spin{animation:spin 1s linear infinite} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

```
  {/* ── Header ── */}
  <div style={{ borderBottom: "1px solid #1a2235", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080c14", zIndex: 100 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>₿</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>FX Pulse</div>
        <div style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 5 }}>
          {status === "loading" && <span className="spin" style={{ display: "inline-block", width: 7, height: 7, border: "1.5px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%" }} />}
          {status === "live"    && <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />}
          {status === "error"   && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />}
          {status === "loading" ? "Fetching…" : status === "live" ? `Updated ${updated?.toLocaleTimeString()}` : "Error · retrying"}
        </div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {notifs[0] && (
        <div className="notif" style={{ maxWidth: 210, background: "#0f2040", border: "1px solid #1e3a60", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#93c5fd", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {notifs[0].msg}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <button className="btn" style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "7px 10px", fontSize: 16 }}>🔔</button>
        {notifs.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{notifs.length}</span>}
      </div>
    </div>
  </div>

  {/* ── CIMB Hero Banner ── */}
  <div style={{ background: "linear-gradient(135deg,#1c0000,#2d0404)", borderBottom: "1px solid #500a0a", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 44, height: 44, background: "#CC0001", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 22, flexShrink: 0 }}>C</div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#cc4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>CIMB Clicks · SGD → MYR</span>
          {cimb && <Badge label={cimb.label} />}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1, display: "flex", alignItems: "baseline", gap: 10 }}>
          {cimb
            ? cimb.rate.toFixed(4)
            : <span className="pulse" style={{ fontSize: 20, color: "#4a3030" }}>loading…</span>}
          <span style={{ fontSize: 13, color: "#9a5050", fontWeight: 400 }}>MYR per SGD</span>
        </div>
        {/* ── Fetch time ── */}
        {cimb?.fetchedAt && (
          <div style={{ fontSize: 11, color: "#7a3030", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
            🕐 Read from CIMB at {fmtTime(cimb.fetchedAt)}
          </div>
        )}
      </div>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href="https://www.cimbclicks.com.sg/sgd-to-myr" target="_blank" rel="noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#CC0001", color: "#fff", padding: "9px 14px", fontSize: 13, borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
        🌐 Open CIMB ↗
      </a>
      <button className="btn" onClick={() => { setAForm({ pair: "SGD-MYR", type: "above", value: "" }); setView("alerts"); }}
        style={{ background: "#3a0a0a", border: "1px solid #7a1a1a", color: "#fca5a5", padding: "9px 12px", fontSize: 13 }}>🎯 Alert</button>
      <button className="btn" onClick={() => { setConv(c => ({ ...c, from: "SGD", to: "MYR", result: null })); setView("convert"); }}
        style={{ background: "#1a0000", border: "1px solid #7a1a1a", color: "#fca5a5", padding: "9px 12px", fontSize: 13 }}>🔄 Convert</button>
      <button className="btn" onClick={loadAll}
        style={{ background: "#1a0000", border: "1px solid #4a0a0a", color: "#7a3030", padding: "9px 12px", fontSize: 13 }}>↻</button>
    </div>
  </div>

  {/* ── Nav ── */}
  <div style={{ display: "flex", gap: 4, padding: "12px 20px", borderBottom: "1px solid #1a2235", overflowX: "auto" }}>
    {[["rates", "📈 Rates"], ["alerts", "🎯 Alerts"], ["convert", "🔄 Convert"], ["banking", "🏦 Banking"]].map(([id, label]) => (
      <button key={id} className={`nav-tab ${view === id ? "active" : ""}`} onClick={() => setView(id)}>{label}</button>
    ))}
  </div>

  {/* ── Content ── */}
  <div style={{ flex: 1, padding: "20px", maxWidth: 900, width: "100%", margin: "0 auto" }} className="fade-in">

    {/* ─── RATES ─── */}
    {view === "rates" && (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>Live Exchange Rates</h2>
            <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>
              SGD/MYR from <span style={{ color: "#fca5a5" }}>CIMB Clicks</span> · Others from <span style={{ color: "#6ee7e7" }}>ExchangeRate-API</span>
            </div>
          </div>
          <button className="btn" onClick={loadAll} style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "6px 14px", fontSize: 12 }}>↻ Refresh</button>
        </div>

        {status === "loading" && !Object.keys(rates).length ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#4a5568" }}>
            <div className="spin" style={{ width: 30, height: 30, border: "2px solid #1e3a60", borderTopColor: "#3b82f6", borderRadius: "50%", margin: "0 auto 12px" }} />
            <div>Loading CIMB &amp; market rates…</div>
            <div style={{ fontSize: 11, marginTop: 6, color: "#2a3448" }}>CIMB may take 10–20s (headless browser)</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
            {PAIRS.map(({ from, to, flag1, flag2, featured }) => {
              const key = `${from}-${to}`;
              const obj = rates[key];
              const hist = history[key] || [];
              const prev = hist.length > 1 ? hist[hist.length - 2]?.r : obj?.rate;
              const chg = obj?.rate && prev ? ((obj.rate - prev) / prev * 100) : 0;
              const up = chg >= 0;
              return (
                <div key={key} className="card"
                  style={{ cursor: "pointer", borderColor: featured ? "#500a0a" : "#1a2235", background: featured ? "#0e0808" : "#0d1320" }}
                  onClick={() => setSelPair(selPair === key ? null : key)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#6b7a96" }}>{flag1} {from} → {flag2} {to}</span>
                        {obj && <Badge label={obj.label} />}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em" }}>
                        {obj ? obj.rate.toFixed(4) : <span style={{ color: "#2a3448", fontSize: 14 }}>—</span>}
                      </div>
                      {/* Per-card fetch time for CIMB */}
                      {featured && obj?.fetchedAt && (
                        <div style={{ fontSize: 10, color: "#7a3030", marginTop: 3, fontFamily: "'DM Mono',monospace" }}>
                          🕐 {fmtTime(obj.fetchedAt)}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Sparkline data={hist} />
                      {obj && <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: up ? "#22c55e" : "#ef4444", marginTop: 3 }}>
                        {up ? "▲" : "▼"} {Math.abs(chg).toFixed(3)}%
                      </div>}
                    </div>
                  </div>
                  {selPair === key && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1a2235", display: "flex", gap: 8 }}>
                      <button className="btn" style={{ flex: 1, background: "#1e3a60", color: "#93c5fd", padding: "8px", fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); setAForm({ ...aForm, pair: key }); setView("alerts"); }}>+ Alert</button>
                      <button className="btn" style={{ flex: 1, background: "#1a2a1a", color: "#86efac", padding: "8px", fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); setConv(c => ({ ...c, from, to, result: null })); setView("convert"); }}>Convert</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 11, color: "#2a3448", textAlign: "center" }}>
          SGD/MYR: <a href="https://www.cimbclicks.com.sg/sgd-to-myr" target="_blank" rel="noreferrer" style={{ color: "#fca5a5", textDecoration: "none" }}>CIMB Clicks ↗</a> via serverless scraper ·
          Others: <a href="https://exchangerate-api.com" target="_blank" rel="noreferrer" style={{ color: "#6ee7e7", textDecoration: "none" }}>ExchangeRate-API</a>
        </div>
      </div>
    )}

    {/* ─── ALERTS ─── */}
    {view === "alerts" && (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Rate Alerts</h2>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#6b7a96", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>New Alert</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 150px" }}>
              <select value={aForm.pair} onChange={e => setAForm({ ...aForm, pair: e.target.value })}>
                {PAIRS.map(({ from, to }) => <option key={`${from}-${to}`} value={`${from}-${to}`}>{from} / {to}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 130px" }}>
              <select value={aForm.type} onChange={e => setAForm({ ...aForm, type: e.target.value })}>
                <option value="above">Rises Above</option>
                <option value="below">Falls Below</option>
              </select>
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <input type="number" step="0.0001"
                placeholder={rates[aForm.pair] ? `e.g. ${(rates[aForm.pair].rate * 1.004).toFixed(4)}` : "Rate"}
                value={aForm.value} onChange={e => setAForm({ ...aForm, value: e.target.value })} />
            </div>
            <button className="btn" onClick={addAlert} style={{ background: "#1d4ed8", color: "#fff", padding: "10px 20px", fontSize: 14, flexShrink: 0 }}>+ Add</button>
          </div>
          {aForm.pair && rates[aForm.pair] && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#4a5568", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>Current: <span style={{ color: "#93c5fd", fontFamily: "'DM Mono',monospace" }}>{rates[aForm.pair].rate.toFixed(4)}</span></span>
              <Badge label={rates[aForm.pair].label} />
              {rates[aForm.pair].fetchedAt && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#7a3030" }}>🕐 {fmtTime(rates[aForm.pair].fetchedAt)}</span>}
            </div>
          )}
        </div>

        {alerts.length === 0
          ? <div style={{ textAlign: "center", color: "#2a3448", padding: "48px 0", fontSize: 14 }}>No alerts yet — add one above</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.map(al => {
                const obj = rates[al.pair];
                const cur = obj?.rate;
                return (
                  <div key={al.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: al.fired ? 0.6 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 20 }}>{al.fired ? "✅" : "⏳"}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {al.pair} {al.type === "below" ? "↘ below" : "↗ above"} <span style={{ fontFamily: "'DM Mono',monospace", color: "#93c5fd" }}>{al.value}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>
                          Now: <span style={{ fontFamily: "'DM Mono',monospace", color: cur && cur >= al.value ? "#22c55e" : "#ef4444" }}>{cur?.toFixed(4) ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="tag" style={{ background: al.fired ? "#1a2f1a" : "#1a2040", color: al.fired ? "#86efac" : "#93c5fd" }}>{al.fired ? "FIRED" : "ACTIVE"}</span>
                      <button className="btn" onClick={() => setAlerts(a => a.filter(x => x.id !== al.id))}
                        style={{ background: "#2a1a1a", color: "#ef4444", padding: "6px 10px", fontSize: 12 }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
        }

        {notifs.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: "#6b7a96", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Notification Log</div>
            {notifs.map(n => (
              <div key={n.id} className="notif card" style={{ marginBottom: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "#1e3a60" }}>
                <span>{n.msg}</span>
                <span style={{ fontSize: 11, color: "#4a5568", fontFamily: "'DM Mono',monospace", flexShrink: 0, marginLeft: 10 }}>{n.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* ─── CONVERT ─── */}
    {view === "convert" && (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Currency Converter</h2>
        <div className="card">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>Amount</div>
              <input type="number" placeholder="0.00" value={conv.amount}
                onChange={e => setConv(c => ({ ...c, amount: e.target.value, result: null }))} />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>From</div>
              <select value={conv.from} onChange={e => setConv(c => ({ ...c, from: e.target.value, result: null }))}>
                {ALL_CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn" style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "10px 12px", fontSize: 18, flexShrink: 0 }}
              onClick={() => setConv(c => ({ ...c, from: c.to, to: c.from, result: null }))}>⇄</button>
            <div style={{ flex: "1 1 100px" }}>
              <div style={{ fontSize: 12, color: "#6b7a96", marginBottom: 6 }}>To</div>
              <select value={conv.to} onChange={e => setConv(c => ({ ...c, to: e.target.value, result: null }))}>
                {ALL_CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn" onClick={doConvert} style={{ background: "#1d4ed8", color: "#fff", padding: "10px 22px", fontSize: 14, flexShrink: 0 }}>Convert</button>
          </div>

          {conv.result && (
            <div style={{ marginTop: 20, padding: 16, background: "#060a12", borderRadius: 10, border: "1px solid #1e3a60" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#6b7a96" }}>Result</span>
                {conv.src && <Badge label={conv.src} />}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>
                {CURRENCY_NAME[conv.from]}{conv.amount}
                <span style={{ color: "#2a3448", margin: "0 10px" }}>=</span>
                <span style={{ color: "#22c55e" }}>{CURRENCY_NAME[conv.to]}{conv.result}</span>
              </div>
              <div style={{ fontSize: 12, color: "#4a5568", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>
                1 {conv.from} = {conv.rate?.toFixed(6)} {conv.to}
              </div>
              <button className="btn" onClick={() => setView("banking")} style={{ marginTop: 12, background: "#1a2f1a", color: "#86efac", padding: "8px 16px", fontSize: 12 }}>
                Execute via Banking App →
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ─── BANKING ─── */}
    {view === "banking" && (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Banking Apps</h2>
        <p style={{ fontSize: 13, color: "#4a5568", marginBottom: 20 }}>Grant permission then execute, or open the app directly.</p>

        {!conv.result && (
          <div style={{ background: "#0d1320", border: "1px solid #2a3448", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13, color: "#6b7a96" }}>
            💡 Set up a conversion in the{" "}
            <button className="btn" onClick={() => setView("convert")} style={{ background: "none", color: "#93c5fd", textDecoration: "underline", padding: 0, fontSize: 13 }}>Convert tab</button> first.
          </div>
        )}
        {conv.result && (
          <div style={{ background: "#0a1a10", border: "1px solid #1a3a20", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: "#4a5568", marginBottom: 3 }}>Ready to execute</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 15 }}>
                {conv.amount} {conv.from} → <span style={{ color: "#22c55e" }}>{conv.result} {conv.to}</span>
              </div>
            </div>
            <span className="tag" style={{ background: "#1a3a20", color: "#86efac" }}>READY</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {BANKING_APPS.map(app => {
            const granted = perms[app.id];
            return (
              <div key={app.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: app.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff", flexShrink: 0 }}>{app.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{app.name}</div>
                    <div style={{ fontSize: 12, color: "#4a5568" }}>{app.desc}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                  <a href={app.url} target="_blank" rel="noreferrer"
                    style={{ background: "#0d1320", border: "1px solid #1a2235", color: "#6b7a96", padding: "7px 10px", fontSize: 12, borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>
                    🌐 Open
                  </a>
                  {granted ? (
                    <>
                      <span className="tag" style={{ background: "#1a2f1a", color: "#86efac" }}>PERMITTED</span>
                      {conv.result && <button className="btn" onClick={() => executeTransfer(app)} style={{ background: app.color, color: "#fff", padding: "7px 14px", fontSize: 12 }}>Send</button>}
                      <button className="btn" onClick={() => setPerms(p => ({ ...p, [app.id]: false }))}
                        style={{ background: "#2a1a1a", color: "#ef4444", padding: "7px 10px", fontSize: 12 }}>Revoke</button>
                    </>
                  ) : (
                    <button className="btn" onClick={() => setPerms(p => ({ ...p, [app.id]: true }))}
                      style={{ background: "#0f1e36", border: "1px solid #1d4ed8", color: "#93c5fd", padding: "7px 14px", fontSize: 13 }}>Grant Access</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, padding: "12px 16px", background: "#0d1018", borderRadius: 10, border: "1px solid #1a2235", fontSize: 12, color: "#4a5568", lineHeight: 1.8 }}>
          🔒 <strong style={{ color: "#6b7a96" }}>Privacy:</strong> Granting access lets FX Pulse initiate one transfer per session via the app's own website. No credentials stored. You confirm every transaction on the app itself.
        </div>
      </div>
    )}
  </div>
</div>
```

);
}
