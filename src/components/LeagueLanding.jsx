import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { validatePlayerData } from "../utils/validatePlayerData";

const LEAGUE_ID   = "1321707192847450112";
const LEAGUE_NAME = "Worm Up Dynasty 🪱🪱🪱";
const SLEEPER_CDN = "https://sleepercdn.com/avatars/thumbs";

const ISSUE_LABELS = {
  MISSING_KTC:      { label: "Missing KTC",       color: "#ef4444" },
  MISSING_FC:       { label: "Missing FC",         color: "#ef4444" },
  NAME_MISMATCH:    { label: "Name Mismatch",      color: "#f59e0b" },
  VALUE_DIVERGENCE: { label: "Value Divergence",   color: "#f59e0b" },
};

function teamRecord(rosters, userId) {
  const r = rosters.find(r => r.owner_id === userId);
  if (!r) return "—";
  const w = r.settings?.wins ?? 0, l = r.settings?.losses ?? 0, t = r.settings?.ties ?? 0;
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function TeamCard({ user, record }) {
  const navigate  = useNavigate();
  const teamName  = user.metadata?.team_name || user.display_name || "Unknown Team";
  const avatarUrl = user.avatar ? `${SLEEPER_CDN}/${user.avatar}` : null;

  return (
    <div
      onClick={() => navigate(`/team/${user.user_id}`)}
      style={{ background: "#0c1828", border: "1px solid #1a2d40", borderRadius: 12, padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "border-color 0.15s, background 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f660"; e.currentTarget.style.background = "#0d1e35"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2d40";   e.currentTarget.style.background = "#0c1828"; }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #1a2d40" }} />
        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1a2d40", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#334155", fontSize: 18 }}>🏈</span></div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamName}</div>
        <div style={{ color: "#334155", fontSize: 10, fontFamily: "'Space Mono',monospace", marginTop: 3 }}>{user.display_name} · {record}</div>
      </div>
      <span style={{ color: "#1e3a5f", fontSize: 16, flexShrink: 0 }}>›</span>
    </div>
  );
}

// ── Validator tab ─────────────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: "#0c1828", border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 80 }}>
      <div style={{ color, fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: "0.15em", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#f1f5f9", fontSize: 28, fontFamily: "'Bebas Neue',cursive", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function IssueGroup({ type, issues, isError }) {
  const [open, setOpen] = useState(false);
  const meta = ISSUE_LABELS[type] ?? { label: type, color: "#64748b" };
  return (
    <div style={{ border: "1px solid #1a2d40", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", background: "#0c1828", border: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
      >
        <span style={{ background: meta.color + "20", color: meta.color, border: `1px solid ${meta.color}50`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>{meta.label}</span>
        <span style={{ color: "#475569", fontSize: 10, fontFamily: "'Space Mono',monospace" }}>{issues.length} {isError ? "errors" : "warnings"}</span>
        <span style={{ marginLeft: "auto", color: "#334155", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: "#080e1a" }}>
          {issues.map((issue, i) => (
            <div key={i} style={{ padding: "8px 14px", borderTop: "1px solid #0d1825" }}>
              <div style={{ color: "#e2e8f0", fontSize: 12, fontFamily: "'DM Sans',sans-serif", fontWeight: 600 }}>{issue.playerName}</div>
              <div style={{ color: "#475569", fontSize: 10, fontFamily: "'Space Mono',monospace", marginTop: 2 }}>{issue.detail}</div>
              <div style={{ color: "#1e3a5f", fontSize: 9, fontFamily: "'Space Mono',monospace", marginTop: 1 }}>SLEEPER ID: {issue.sleeperId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValidatorPanel() {
  const [report,  setReport]  = useState(null);
  const [running, setRunning] = useState(false);
  const [error,   setError]   = useState(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const result = await validatePlayerData();
      setReport(result);
    } catch (e) {
      setError(e.message || "Validation failed");
    } finally {
      setRunning(false);
    }
  }

  const groupBy = (issues) => issues.reduce((acc, i) => { (acc[i.type] ??= []).push(i); return acc; }, {});

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={run}
          disabled={running}
          style={{ background: running ? "#0c1828" : "#1e3a5f", border: "1px solid #3b82f640", borderRadius: 6, color: running ? "#334155" : "#93c5fd", fontSize: 11, fontFamily: "'Space Mono',monospace", fontWeight: 700, padding: "8px 16px", cursor: running ? "not-allowed" : "pointer", letterSpacing: "0.1em" }}
        >{running ? "RUNNING..." : "RUN VALIDATION"}</button>
        {report && <span style={{ color: "#1e3a5f", fontSize: 9, fontFamily: "'Space Mono',monospace" }}>{new Date(report.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
      </div>

      {error && <div style={{ color: "#ef4444", fontSize: 11, fontFamily: "'Space Mono',monospace", marginBottom: 14 }}>ERROR: {error}</div>}

      {report && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <StatPill label="CHECKED"  value={report.checked}         color="#3b82f6" />
            <StatPill label="ERRORS"   value={report.errors.length}   color="#ef4444" />
            <StatPill label="WARNINGS" value={report.warnings.length} color="#f59e0b" />
            <StatPill label="CLEAN"    value={report.clean}           color="#10b981" />
          </div>

          {report.errors.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#ef4444", fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: "0.18em", marginBottom: 10 }}>ERRORS</div>
              {Object.entries(groupBy(report.errors)).map(([type, issues]) => (
                <IssueGroup key={type} type={type} issues={issues} isError={true} />
              ))}
            </div>
          )}

          {report.warnings.length > 0 && (
            <div>
              <div style={{ color: "#f59e0b", fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: "0.18em", marginBottom: 10 }}>WARNINGS</div>
              {Object.entries(groupBy(report.warnings)).map(([type, issues]) => (
                <IssueGroup key={type} type={type} issues={issues} isError={false} />
              ))}
            </div>
          )}

          {report.errors.length === 0 && report.warnings.length === 0 && (
            <div style={{ color: "#10b981", fontSize: 12, fontFamily: "'Space Mono',monospace", textAlign: "center", paddingTop: 20 }}>ALL {report.checked} PLAYERS CLEAN ✓</div>
          )}
        </>
      )}
    </div>
  );
}

// ── Landing page ──────────────────────────────────────────────────────────────

const TABS = [{ key: "teams", label: "TEAMS" }, { key: "validator", label: "VALIDATOR" }];

export default function LeagueLanding() {
  const [users,   setUsers]   = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("teams");

  useEffect(() => {
    async function load() {
      try {
        const [uRes, rRes] = await Promise.all([
          fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/users`),
          fetch(`/api/sleeper?path=/league/${LEAGUE_ID}/rosters`),
        ]);
        if (!uRes.ok || !rRes.ok) throw new Error("fetch failed");
        const [u, r] = await Promise.all([uRes.json(), rRes.json()]);
        setUsers(Array.isArray(u) ? u : []);
        setRosters(Array.isArray(r) ? r : []);
      } catch { /* show whatever loaded */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const sorted = [...users].sort((a, b) =>
    (a.metadata?.team_name || a.display_name || "").toLowerCase()
      .localeCompare((b.metadata?.team_name || b.display_name || "").toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060d16", color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif", paddingBottom: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');* { box-sizing:border-box; margin:0; }`}</style>

      <div style={{ background: "linear-gradient(135deg,#08152a 0%,#0c1e3d 60%,#08152a 100%)", borderBottom: "1px solid #1a3050", padding: "32px 20px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(90deg,#3b82f6 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <div style={{ position: "relative" }}>
          <div style={{ color: "#3b82f6", fontSize: 10, fontFamily: "'Space Mono',monospace", letterSpacing: "0.22em", marginBottom: 6 }}>DYNASTY COMMAND CENTER</div>
          <h1 style={{ fontSize: 40, fontFamily: "'Bebas Neue',cursive", letterSpacing: "0.06em", color: "#f1f5f9", lineHeight: 1 }}>{LEAGUE_NAME}</h1>
          <div style={{ color: "#1e3a5f", fontSize: 11, fontFamily: "'Space Mono',monospace", marginTop: 6 }}>SELECT YOUR TEAM</div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #1a2d40" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? "#0a1525" : "transparent", border: "none", borderBottom: `2px solid ${tab === t.key ? "#3b82f6" : "transparent"}`, color: tab === t.key ? "#60a5fa" : "#334155", padding: "12px 20px", fontSize: 11, fontFamily: "'Space Mono',monospace", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 16px" }}>
        {tab === "teams" && (
          <div style={{ paddingTop: 20 }}>
            {loading && <div style={{ color: "#334155", fontSize: 11, fontFamily: "'Space Mono',monospace", textAlign: "center", paddingTop: 40 }}>LOADING TEAMS...</div>}
            {!loading && sorted.map(user => (
              <div key={user.user_id} style={{ marginBottom: 10 }}>
                <TeamCard user={user} record={teamRecord(rosters, user.user_id)} />
              </div>
            ))}
          </div>
        )}
        {tab === "validator" && <ValidatorPanel />}
      </div>
    </div>
  );
}
