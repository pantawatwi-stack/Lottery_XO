import { useEffect, useState } from "react";

const FALLBACK_DATA = [
    { date: "01/03/69", type: "ไทย", first: "820866", two_front: "82", two_back: "06", three_front: "479", three_back: "837" },
    { date: "16/02/69", type: "ไทย", first: "340563", two_front: "34", two_back: "07", three_front: "527", three_back: "169" },
    { date: "01/02/69", type: "ไทย", first: "174629", two_front: "17", two_back: "48", three_front: "195", three_back: "041" },
    { date: "17/01/69", type: "ไทย", first: "878972", two_front: "87", two_back: "02", three_front: "299", three_back: "662" },
    { date: "02/01/69", type: "ไทย", first: "837706", two_front: "83", two_back: "16", three_front: "694", three_back: "288" },
];

function parseGLOList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
        try {
            const { date, data } = item;
            const first = data?.first?.[0] ?? "";
            const two_back = data?.last2?.[0] ?? "";
            const three_front = data?.last3f?.[0] ?? "";
            const three_back = data?.last3b?.[0] ?? "";
            if (!first || first.length < 6) return null;
            const [y, m, d] = date.split("-");
            const thYear = parseInt(y) + 543;
            return {
                date: `${d}/${m}/${String(thYear).slice(-2)}`,
                isoDate: date,
                type: "ไทย", first,
                two_front: first.slice(0, 2), two_back, three_front, three_back,
            };
        } catch { return null; }
    }).filter(Boolean);
}

async function fetchGLOData(setStatus) {
    const ceYear = new Date().getFullYear();
    const all = [];
    for (const year of [ceYear, ceYear - 1]) {
        setStatus(`กำลังโหลดข้อมูลปี ${year}...`);
        try {
            const res = await fetch("/glo-api/api/lottery/getLotteryResultByYear", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: String(year) }), signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) continue;
            const json = await res.json();
            if (Array.isArray(json?.response)) all.push(...parseGLOList(json.response));
        } catch { }
    }
    return all.sort((a, b) => (b.isoDate ?? b.date).localeCompare(a.isoDate ?? a.date));
}

function buildStats(data) {
    const freq = {};
    for (let i = 0; i <= 9; i++) freq[i] = 0;
    data.forEach(d => String(d.first).split("").forEach(ch => { const n = parseInt(ch); if (!isNaN(n)) freq[n]++; }));
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const grid = Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => {
            const idx = r * 3 + c;
            return { digit: parseInt(sorted[idx][0]), count: sorted[idx][1], rank: idx + 1 };
        })
    );
    return { freq, sorted, grid, hot: sorted.slice(0, 3).map(([d]) => parseInt(d)), cold: sorted.slice(-3).map(([d]) => parseInt(d)) };
}

function runFormula(formula, sorted) {
    const top5 = sorted.slice(0, 5).map(([d]) => parseInt(d));
    if (formula === "บวก1") return top5.map(d => ({ val: (d + 1) % 10 }));
    if (formula === "คู่") return top5.filter(d => d % 2 === 0).map(d => ({ val: d }));
    if (formula === "คี่") return top5.filter(d => d % 2 !== 0).map(d => ({ val: d }));
    if (formula === "กลับเลข") {
        const t = sorted.slice(0, 3).map(([d]) => parseInt(d));
        return t.flatMap(a => t.filter(b => b !== a).map(b => ({ val: `${a}${b}` })));
    }
    return [];
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; }
  body { background: #0d1117; }
  .tabs::-webkit-scrollbar { display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
`;

export default function LotteryXO() {
    const [draws, setDraws] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadStatus, setLoadStatus] = useState("กำลังเริ่มต้น...");
    const [apiError, setApiError] = useState(false);
    const [tab, setTab] = useState("xo");
    const [formula, setFormula] = useState("บวก1");
    const [notes, setNotes] = useState([]);
    const [noteText, setNoteText] = useState("");
    const [addMode, setAddMode] = useState(false);
    const [newDraw, setNewDraw] = useState({ date: "", type: "ไทย", first: "" });
    const [sortOrder, setSortOrder] = useState("desc");

    // disclaimer: เช็คว่าวันนี้เคยกด "ไม่แสดงอีก" หรือยัง
    const todayKey = `disclaimer_${new Date().toISOString().slice(0, 10)}`;
    const [showDisclaimer, setShowDisclaimer] = useState(() => {
        try { return localStorage.getItem(todayKey) !== "hide"; } catch { return true; }
    });
    function dismissDisclaimer(hideToday) {
        if (hideToday) { try { localStorage.setItem(todayKey, "hide"); } catch { } }
        setShowDisclaimer(false);
    }

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true); setApiError(false);
        try {
            const results = await fetchGLOData(setLoadStatus);
            if (results.length > 0) { setDraws(results); setLoadStatus(`โหลดสำเร็จ ${results.length} งวด ✅`); }
            else throw new Error();
        } catch {
            setDraws(FALLBACK_DATA); setApiError(true);
            setLoadStatus("ไม่สามารถโหลดข้อมูลได้ — ตรวจสอบ proxy config");
        } finally { setLoading(false); }
    }

    const activeDraws = draws.length > 0 ? draws : FALLBACK_DATA;
    const { freq, sorted, grid, hot, cold } = buildStats(activeDraws);
    const maxFreq = Math.max(...Object.values(freq));
    const formulaResults = runFormula(formula, sorted);

    function addDraw() {
        if (newDraw.first.length !== 6) { alert("กรุณากรอกตัวเลข 6 หลัก"); return; }
        const f = newDraw.first;
        setDraws(prev => [{ ...newDraw, isoDate: "", two_front: f.slice(0, 2), two_back: f.slice(-2), three_front: f.slice(0, 3), three_back: f.slice(-3) }, ...prev]);
        setNewDraw({ date: "", type: "ไทย", first: "" }); setAddMode(false);
    }

    function saveNote() {
        if (!noteText.trim()) return;
        setNotes(prev => [{ id: Date.now(), text: noteText, formula }, ...prev]);
        setNoteText("");
    }

    // ── Design tokens ──────────────────────────────────────────────────────────
    const orange = "#f6ad55";
    const muted = "#718096";
    const mono = "monospace";

    const s = {
        wrap: { minHeight: "100vh", width: "100%", background: "linear-gradient(160deg,#0d1117,#161b27)", color: "#e2e8f0", fontFamily: "sans-serif", padding: "16px" },
        card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px", marginBottom: 14, width: "100%" },
        input: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 14, outline: "none" },
        btnPrimary: { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "linear-gradient(135deg,#f6ad55,#ed8936)", color: "#1a202c" },
        btnGhost: (active) => ({ padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", background: active ? "linear-gradient(135deg,#f6ad55,#ed8936)" : "rgba(255,255,255,0.07)", color: active ? "#1a202c" : muted }),
    };

    if (loading) return (
        <>
            <style>{CSS}</style>
            <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#e2e8f0", fontFamily: "sans-serif", padding: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1.2s linear infinite", display: "inline-block" }}>🎱</div>
                <h2 style={{ color: orange, marginBottom: 8, fontSize: 18 }}>กำลังโหลดข้อมูล GLO</h2>
                <p style={{ color: muted, fontSize: 13, textAlign: "center" }}>{loadStatus}</p>
                <div style={{ marginTop: 20, width: "60%", maxWidth: 200, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                    <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg,#f6ad55,#ed8936)", borderRadius: 2, animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
            </div>
        </>
    );

    return (
        <>
            <style>{CSS}</style>
            <div style={s.wrap}>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: orange, marginBottom: 4 }}>LOTTERY INTELLIGENCE</div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: orange }}>ระบบวิเคราะห์หวย XO</h1>
                    <p style={{ fontSize: 12, color: muted, marginTop: 4 }}>วิเคราะห์จากสถิติย้อนหลัง {activeDraws.length} งวด</p>
                </div>

                {/* Status */}
                {apiError ? (
                    <div style={{ background: "rgba(245,101,101,0.1)", border: "1px solid rgba(245,101,101,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ flex: 1, fontSize: 12, color: "#fc8181" }}>⚠️ {loadStatus}</span>
                        <button onClick={loadData} style={{ ...s.btnPrimary, background: "rgba(245,101,101,0.2)", color: "#fc8181", padding: "5px 12px", fontSize: 12 }}>🔄 ลองใหม่</button>
                    </div>
                ) : (
                    <div style={{ background: "rgba(72,187,120,0.1)", border: "1px solid rgba(72,187,120,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#68d391" }}>
                        ✅ {loadStatus}
                    </div>
                )}

                {/* Hot/Cold */}
                {(() => {
                    const totalDigits = activeDraws.length * 6; // รางวัลที่ 1 มี 6 หลัก
                    // คำนวณ trend: เปรียบเทียบครึ่งแรก vs ครึ่งหลังของข้อมูล
                    const half = Math.floor(activeDraws.length / 2);
                    const recentFreq = {}, oldFreq = {};
                    for (let i = 0; i <= 9; i++) { recentFreq[i] = 0; oldFreq[i] = 0; }
                    activeDraws.forEach((d, idx) => {
                        const target = idx < half ? recentFreq : oldFreq;
                        String(d.first).split("").forEach(ch => { const n = parseInt(ch); if (!isNaN(n)) target[n]++; });
                    });
                    const getTrend = (d) => {
                        const r = recentFreq[d] / Math.max(half, 1);
                        const o = oldFreq[d] / Math.max(activeDraws.length - half, 1);
                        if (r > o * 1.15) return { icon: "↑", color: "#68d391" };
                        if (r < o * 0.85) return { icon: "↓", color: "#fc8181" };
                        return { icon: "→", color: "#718096" };
                    };

                    const renderGroup = (digits, label, emoji, accentColor, bgColor) => (
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{emoji}</span>
                                <span style={{ color: accentColor, fontWeight: 600 }}>{label}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {digits.map((d, rank) => {
                                    const count = freq[d] || 0;
                                    const pct = totalDigits > 0 ? ((count / totalDigits) * 100).toFixed(1) : "0.0";
                                    const barPct = maxFreq > 0 ? (count / maxFreq) * 100 : 0;
                                    const trend = getTrend(d);
                                    return (
                                        <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {/* อันดับ */}
                                            <span style={{ fontSize: 10, color: "#4a5568", width: 12 }}>#{rank + 1}</span>
                                            {/* ตัวเลข */}
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, fontFamily: mono, color: "#fff", flexShrink: 0 }}>{d}</div>
                                            {/* mini bar + % */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                    <span style={{ fontSize: 10, color: muted }}>{count} ครั้ง</span>
                                                    <span style={{ fontSize: 10, color: accentColor, fontWeight: 600 }}>{pct}%</span>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 2, background: accentColor, opacity: 0.7 }} />
                                                </div>
                                            </div>
                                            {/* trend */}
                                            <span style={{ fontSize: 13, color: trend.color, fontWeight: 700, width: 16, textAlign: "center" }}>{trend.icon}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );

                    return (
                        <div style={{ ...s.card, marginBottom: 14 }}>
                            <div style={{ display: "flex", gap: 16 }}>
                                {renderGroup(hot, "เลขร้อน", "🔥", "#f6ad55", "rgba(246,173,85,0.25)")}
                                <div style={{ width: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
                                {renderGroup(cold, "เลขเย็น", "❄️", "#63b3ed", "rgba(99,179,237,0.25)")}
                            </div>
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                {[["↑", "กำลังมา", "#68d391"], ["→", "ทรงตัว", "#718096"], ["↓", "ขาลง", "#fc8181"]].map(([icon, label, color]) => (
                                    <span key={icon} style={{ fontSize: 10, color: muted, display: "flex", alignItems: "center", gap: 3 }}>
                                        <span style={{ color, fontWeight: 700 }}>{icon}</span> {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Tabs */}
                <div className="tabs" style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
                    {[["xo", "ตาราง XO"], ["stats", "กราฟสถิติ"], ["formula", "สูตรเดินเลข"], ["history", "ประวัติ"], ["setup", "ตั้งค่า"]].map(([id, label]) => (
                        <button key={id} style={s.btnGhost(tab === id)} onClick={() => setTab(id)}>{label}</button>
                    ))}
                </div>

                {/* ── XO Tab ── */}
                {tab === "xo" && (
                    <div style={s.card}>
                        <h2 style={{ fontSize: 14, color: orange, marginBottom: 14 }}>ตาราง XO 3×3 (จัดตามความถี่)</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "100%" }}>
                            {grid.flat().map((cell, i) => {
                                const isHot = hot.includes(cell.digit);
                                const isCold = cold.includes(cell.digit);
                                const bg = isHot ? "linear-gradient(135deg,#f6ad55,#ed8936)" : isCold ? "linear-gradient(135deg,#63b3ed,#4299e1)" : "rgba(255,255,255,0.07)";
                                return (
                                    <div key={i} style={{ aspectRatio: "1", borderRadius: 10, background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
                                        <span style={{ fontSize: "clamp(20px, 7vw, 28px)", fontWeight: 700, fontFamily: mono, color: "#fff" }}>{cell.digit}</span>
                                        <span style={{ fontSize: "clamp(9px, 2.5vw, 11px)", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>ออก {cell.count}×</span>
                                        <span style={{ position: "absolute", top: 3, right: 5, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>#{cell.rank}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 16, background: "rgba(246,173,85,0.07)", border: "1px solid rgba(246,173,85,0.2)", borderRadius: 10, padding: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: orange, marginBottom: 10 }}>🎯 เลขแนะนำ</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {hot.flatMap(a => hot.filter(b => b !== a).map(b => `${a}${b}`)).map(num => (
                                    <div key={num} style={{ background: "rgba(246,173,85,0.15)", border: "1px solid rgba(246,173,85,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 18, fontWeight: 700, fontFamily: mono, color: "#fbd38d" }}>{num}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Stats Tab ── */}
                {tab === "stats" && (
                    <div style={s.card}>
                        <h2 style={{ fontSize: 14, color: orange, marginBottom: 16 }}>กราฟความถี่เลข 0–9</h2>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, marginBottom: 20, width: "100%" }}>
                            {Array.from({ length: 10 }, (_, i) => {
                                const val = freq[i] || 0;
                                const pct = maxFreq > 0 ? (val / maxFreq) * 100 : 0;
                                return (
                                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                        <span style={{ fontSize: 9, color: muted }}>{val}</span>
                                        <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${Math.max(pct, 4)}%`, background: `hsl(${Math.round((pct / 100) * 120)},70%,55%)` }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: mono }}>{i}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {sorted.map(([digit, count], i) => (
                            <div key={digit} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <span style={{ width: 20, fontSize: 10, color: muted, textAlign: "right" }}>#{i + 1}</span>
                                <span style={{ width: 18, fontFamily: mono, fontWeight: 700, fontSize: 14 }}>{digit}</span>
                                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                                    <div style={{ height: "100%", borderRadius: 4, width: `${maxFreq > 0 ? (count / maxFreq) * 100 : 0}%`, background: `hsl(${Math.round((count / maxFreq) * 120)},70%,55%)` }} />
                                </div>
                                <span style={{ fontSize: 11, color: muted, fontFamily: mono, whiteSpace: "nowrap" }}>{count} ครั้ง</span>
                            </div>
                        ))}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, color: muted, fontWeight: 600, marginBottom: 8 }}>เลขท้าย 2 ตัวที่ออกบ่อย</div>
                            {(() => {
                                const tf = {};
                                activeDraws.forEach(d => { if (d.two_back) tf[d.two_back] = (tf[d.two_back] || 0) + 1; });
                                return Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => (
                                    <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.25)", borderRadius: 8, padding: "4px 10px", marginRight: 6, marginBottom: 6 }}>
                                        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 15, color: "#90cdf4" }}>{n}</span>
                                        <span style={{ fontSize: 10, color: "#63b3ed" }}>{c}×</span>
                                    </span>
                                ));
                            })()}
                        </div>
                    </div>
                )}

                {/* ── Formula Tab ── */}
                {tab === "formula" && (
                    <div>
                        <div style={s.card}>
                            <h2 style={{ fontSize: 14, color: orange, marginBottom: 12 }}>สูตรเดินเลข</h2>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                                {["บวก1", "คู่", "คี่", "กลับเลข"].map(f => (
                                    <button key={f} style={s.btnGhost(formula === f)} onClick={() => setFormula(f)}>{f}</button>
                                ))}
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12, minHeight: 60 }}>
                                <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>ผลจากสูตร <strong style={{ color: orange }}>{formula}</strong></div>
                                {formulaResults.length === 0
                                    ? <span style={{ color: "#4a5568", fontSize: 13 }}>ไม่พบผลลัพธ์</span>
                                    : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {formulaResults.map((r, i) => <div key={i} style={{ background: "rgba(246,173,85,0.12)", border: "1px solid rgba(246,173,85,0.3)", borderRadius: 8, padding: "6px 14px", fontFamily: mono, fontWeight: 700, fontSize: 18, color: "#fbd38d" }}>{r.val}</div>)}
                                    </div>
                                }
                            </div>
                        </div>
                        <div style={s.card}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: muted, marginBottom: 10 }}>📝 บันทึกสูตรส่วนตัว</div>
                            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} placeholder="จดบันทึกสูตรหรือการวิเคราะห์..."
                                style={{ ...s.input, resize: "vertical", fontFamily: "sans-serif" }} />
                            <button onClick={saveNote} style={{ ...s.btnPrimary, marginTop: 10 }}>บันทึก</button>
                        </div>
                        {notes.length > 0 && (
                            <div style={s.card}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: muted, marginBottom: 12 }}>📚 บันทึกของฉัน</div>
                                {notes.map(n => (
                                    <div key={n.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: "3px solid #f6ad55" }}>
                                        <span style={{ fontSize: 11, color: orange, background: "rgba(246,173,85,0.15)", padding: "2px 8px", borderRadius: 5 }}>สูตร: {n.formula}</span>
                                        <p style={{ margin: "8px 0 6px", fontSize: 13, color: "#cbd5e0", lineHeight: 1.6 }}>{n.text}</p>
                                        <button onClick={() => setNotes(prev => prev.filter(x => x.id !== n.id))} style={{ padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, background: "rgba(245,101,101,0.15)", color: "#fc8181" }}>ลบ</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── History Tab ── */}
                {tab === "history" && (
                    <div style={s.card}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                            <h2 style={{ fontSize: 14, color: orange }}>ประวัติผลรางวัล</h2>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, gap: 2 }}>
                                    {[["desc", "ล่าสุด ↓"], ["asc", "เก่าสุด ↑"]].map(([v, label]) => (
                                        <button key={v} onClick={() => setSortOrder(v)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: sortOrder === v ? "rgba(246,173,85,0.3)" : "transparent", color: sortOrder === v ? orange : muted }}>{label}</button>
                                    ))}
                                </div>
                                <button onClick={() => setAddMode(!addMode)} style={{ ...s.btnGhost(false), fontSize: 12, padding: "6px 12px" }}>
                                    {addMode ? "ยกเลิก" : "+ เพิ่มงวด"}
                                </button>
                            </div>
                        </div>

                        {addMode && (
                            <div style={{ background: "rgba(246,173,85,0.06)", border: "1px solid rgba(246,173,85,0.2)", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                {[["วันที่", "date", "dd/mm/yy", 6], ["รางวัลที่ 1 (6 หลัก)", "first", "123456", 6]].map(([label, field, ph, max]) => (
                                    <div key={field}>
                                        <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>{label}</div>
                                        <input placeholder={ph} maxLength={max} value={newDraw[field]}
                                            onChange={e => setNewDraw(p => ({ ...p, [field]: field === "first" ? e.target.value.replace(/\D/g, "") : e.target.value }))}
                                            style={s.input} />
                                    </div>
                                ))}
                                <div>
                                    <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>ประเภท</div>
                                    <select value={newDraw.type} onChange={e => setNewDraw(p => ({ ...p, type: e.target.value }))} style={{ ...s.input, background: "#1a202c" }}>
                                        <option>ไทย</option><option>หุ้น</option><option>ลาว</option>
                                    </select>
                                </div>
                                <button onClick={addDraw} style={s.btnPrimary}>เพิ่ม</button>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[...activeDraws].sort((a, b) => {
                                const ka = a.isoDate ?? a.date, kb = b.isoDate ?? b.date;
                                return sortOrder === "desc" ? kb.localeCompare(ka) : ka.localeCompare(kb);
                            }).map((d, i) => (
                                <div key={i} style={{ background: i === 0 ? "rgba(246,173,85,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? "rgba(246,173,85,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: "10px 12px" }}>
                                    {/* แถวบน: วันที่ + ประเภท + รางวัลที่ 1 */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span style={{ fontSize: 11, color: muted }}>{d.date}</span>
                                        <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", borderRadius: 4, padding: "1px 6px" }}>{d.type}</span>
                                        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 20, color: i === 0 ? orange : "#e2e8f0", letterSpacing: 3, flex: 1, textAlign: "right" }}>{d.first}</span>
                                    </div>
                                    {/* แถวล่าง: เลขย่อย */}
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 14 }}>
                                        {[["หน้า2", d.two_front, "#90cdf4"], ["ท้าย2", d.two_back, "#90cdf4"], ["หน้า3", d.three_front, "#b794f4"], ["ท้าย3", d.three_back, "#b794f4"]].map(([lbl, val, col]) => (
                                            <div key={lbl} style={{ textAlign: "center" }}>
                                                <div style={{ fontSize: 9, color: "#4a5568" }}>{lbl}</div>
                                                <div style={{ fontFamily: mono, fontWeight: 700, color: col, fontSize: 13 }}>{val || "-"}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Setup Tab ── */}
                {tab === "setup" && (
                    <div style={s.card}>
                        <h2 style={{ fontSize: 14, color: orange, marginBottom: 14 }}>⚙️ vite.config.js</h2>
                        <pre style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: 14, fontSize: 11, color: "#a8ff78", overflowX: "auto", lineHeight: 1.6, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
                            {`import { defineConfig } from 'vite'
                                import react from '@vitejs/plugin-react'

                                export default defineConfig({
                                plugins: [react()],
                                server: {
                                    host: true,
                                    proxy: {
                                    '/glo-api': {
                                        target: 'https://www.glo.or.th',
                                        changeOrigin: true,
                                        rewrite: (path) =>
                                        path.replace(/^\\/glo-api/, ''),
                                    }
                                    }
                                }
                                })`}
                        </pre>
                        <div style={{ background: "rgba(99,179,237,0.08)", border: "1px solid rgba(99,179,237,0.2)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#90cdf4", marginBottom: 6 }}>📌 Endpoint</div>
                            <code style={{ fontSize: 12, color: "#bee3f8", fontFamily: mono, wordBreak: "break-all" }}>POST /api/lottery/getLotteryResultByYear</code>
                            <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>Body: <code style={{ color: "#bee3f8" }}>{`{ "year": "2026" }`}</code></div>
                        </div>
                        <button onClick={loadData} style={s.btnPrimary}>🔄 โหลดข้อมูลใหม่</button>
                    </div>
                )}

                {/* Disclaimer Modal */}
                {showDisclaimer && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                        <div style={{ background: "#1a202c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%" }}>
                            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f6ad55", textAlign: "center", marginBottom: 12 }}>ข้อควรระวัง</h2>
                            <p style={{ fontSize: 13, color: "#a0aec0", lineHeight: 1.7, marginBottom: 8 }}>
                                แอปพลิเคชันนี้<strong style={{ color: "#e2e8f0" }}>จัดทำขึ้นเพื่อความบันเทิงเท่านั้น</strong> ข้อมูลสถิติและการวิเคราะห์ที่แสดงผล<strong style={{ color: "#e2e8f0" }}>ไม่สามารถใช้เป็นหลักประกันหรือทำนายผลลัพธ์ได้</strong>
                            </p>
                            <p style={{ fontSize: 13, color: "#a0aec0", lineHeight: 1.7, marginBottom: 20 }}>
                                การเล่นการพนันทุกประเภทมีความเสี่ยง ควรเล่นอย่างมีสติและอยู่ในขอบเขตที่กฎหมายอนุญาตเท่านั้น
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <button
                                    onClick={() => dismissDisclaimer(false)}
                                    style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "linear-gradient(135deg,#f6ad55,#ed8936)", color: "#1a202c" }}
                                >
                                    รับทราบ และเข้าใช้งาน
                                </button>
                                <button
                                    onClick={() => dismissDisclaimer(true)}
                                    style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "transparent", color: "#718096" }}
                                >
                                    รับทราบแล้ว ไม่ต้องแสดงวันนี้แล้ว
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <p style={{ textAlign: "center", fontSize: 10, color: "#2d3748", marginTop: 12 }}>⚠️ ใช้เพื่อความบันเทิงเท่านั้น</p>
            </div>
        </>
    );
}