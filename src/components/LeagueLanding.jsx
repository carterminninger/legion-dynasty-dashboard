import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { validatePlayerData } from "../utils/validatePlayerData";
import { fixPlayerData }      from "../utils/fixPlayerData";
import { cosmicApp as T, LABEL, NUM, MONO, GEORGIA } from "../kit/theme";
import { Skeleton }   from "../kit/Skeleton";
import { ToastStack } from "../kit/Toast";

const LEAGUE_ID    = "1321707192847450112";
const LEAGUE_NAME  = "Worm Up Dynasty 🪱🪱🪱";
const SLEEPER_CDN  = "https://sleepercdn.com/avatars/thumbs";
const MAX_ATTEMPTS = 3;

const ISSUE_LABELS = {
  MISSING_KTC:           { label: "Missing KTC",       color: "#ff6b35" },
  MISSING_FC:            { label: "Missing FC",         color: "#ff6b35" },
  NAME_MISMATCH:         { label: "Name Mismatch",      color: "#f59e0b" },
  VALUE_DIVERGENCE:      { label: "Value Divergence",   color: "#f59e0b" },
  PICK_VALUE_UNRESOLVED: { label: "Pick Value Missing", color: "#ff6b35" },
  TRADES_UNAVAILABLE:    { label: "Trades Unavailable", color: "#f59e0b" },
  // KNOWN_ABSENT is info, deliberately NOT success green — acceptance is
  // visible, never blessed (ruling 2026-07-15)
  KNOWN_ABSENT:          { label: "Known Absent",       color: "#a0c4d8" },
  ALLOWLIST_STALE:       { label: "Allowlist Stale",    color: "#f59e0b" },
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
    <button
      onClick={() => navigate(`/team/${user.user_id}`)}
      style={{ width:"100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", minHeight: 64, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign:"left", transition: "border-color 0.15s, background 0.15s", color:T.text }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,229,255,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1.5px solid ${T.border}` }} />
        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.surface, border:`1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span aria-hidden style={{ fontSize: 18 }}>🏈</span></div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.text, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamName}</div>
        <div style={{ ...NUM, color: T.muted, opacity:0.75, fontSize: 11, marginTop: 3 }}>{user.display_name} · {record}</div>
      </div>
      <span aria-hidden style={{ color: T.muted, opacity:0.5, fontSize: 16, flexShrink: 0 }}>›</span>
    </button>
  );
}

// ── Validator shared primitives ───────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${color}30`, borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 80 }}>
      <div style={{ ...LABEL, color, fontSize: "9px", marginBottom: 4 }}>{label}</div>
      <div style={{ ...NUM, color: T.text, fontSize: 24, fontWeight:800, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function IssueGroup({ type, issues, isError, noun }) {
  const [open, setOpen] = useState(false);
  const meta = ISSUE_LABELS[type] ?? { label: type, color: T.muted };
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: "100%", background: T.surface, border: "none", padding: "10px 14px", minHeight: 44, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: T.text }}
      >
        <span style={{ background: meta.color + "20", color: meta.color, border: `1px solid ${meta.color}50`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: MONO, fontWeight: 700 }}>{meta.label}</span>
        <span style={{ ...NUM, color: T.muted, fontSize: 11 }}>{issues.length} {noun ?? (isError ? "errors" : "warnings")}</span>
        <span aria-hidden style={{ marginLeft: "auto", color: T.muted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: T.bg }}>
          {issues.map((issue, i) => (
            <div key={i} style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{issue.playerName}</div>
              <div style={{ ...NUM, color: T.muted, fontSize: 11, marginTop: 2 }}>{issue.detail}</div>
              <div style={{ ...NUM, color: T.muted, opacity:0.6, fontSize: 10, marginTop: 1 }}>Sleeper ID: {issue.sleeperId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Formally accepted absences (knownAbsent.json) — info chip, expandable list. */
function AcceptedSection({ accepted }) {
  if (!accepted?.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <IssueGroup type="KNOWN_ABSENT" issues={accepted} isError={false} noun="accepted absences" />
    </div>
  );
}

function FixReportDisplay({ fixReport }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 20, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
      <div style={{ ...LABEL, color: T.muted, fontSize: "10px", marginBottom: 10 }}>Fix report</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <StatPill label="Resolved"      value={fixReport.resolved}              color={T.success} />
        <StatPill label="Manual review" value={fixReport.manualReview.length}   color={T.warm} />
      </div>
      <div style={{ ...NUM, color: T.muted, opacity:0.7, fontSize: 10, marginBottom: 12 }}>
        Aliases saved to this browser — run the check again to see updated counts.
      </div>
      {fixReport.manualReview.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            style={{ width: "100%", background: T.surface, border: "none", padding: "10px 14px", minHeight: 44, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: T.text }}
          >
            <span style={{ background: T.warm+"20", color: T.warm, border: `1px solid ${T.warm}50`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: MONO, fontWeight: 700 }}>NEEDS MANUAL REVIEW</span>
            <span style={{ ...NUM, color: T.muted, fontSize: 11 }}>{fixReport.manualReview.length} players</span>
            <span aria-hidden style={{ marginLeft: "auto", color: T.muted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
          </button>
          {open && (
            <div style={{ background: T.bg }}>
              {fixReport.manualReview.map((item, i) => (
                <div key={i} style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
                  <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{item.playerName}</div>
                  <div style={{ ...NUM, color: T.muted, fontSize: 11, marginTop: 2 }}>{item.type} — {item.detail}</div>
                  {item.suggestedFix && <div style={{ ...NUM, color: T.muted, opacity:0.6, fontSize: 10, marginTop: 2 }}>{item.suggestedFix}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Full Check orchestration ──────────────────────────────────────────────────

/** Run one fix → re-validate cycle. */
async function runCycle(prevReport) {
  const fixReport   = await fixPlayerData(prevReport);
  const afterReport = await validatePlayerData();
  return { fixReport, afterReport };
}

/**
 * Run the full validate → fix → validate chain autonomously.
 * Circuit breaker: stops after MAX_ATTEMPTS if errors still remain.
 * @returns {Promise<{ beforeReport: object, fixReport: object|null, afterReport: object|null, attempts: number, stopped: boolean }>}
 */
async function runFullCheck() {
  const beforeReport = await validatePlayerData();
  if (beforeReport.errors.length === 0)
    return { beforeReport, fixReport: null, afterReport: null, attempts: 1, stopped: false };

  let current  = beforeReport;
  let lastFix  = null;
  let lastAfter = null;
  let attempts  = 0;

  while (attempts < MAX_ATTEMPTS && current.errors.length > 0) {
    attempts++;
    const { fixReport, afterReport } = await runCycle(current);
    lastFix   = fixReport;
    lastAfter = afterReport;
    current   = afterReport;
  }

  return { beforeReport, fixReport: lastFix, afterReport: lastAfter, attempts, stopped: current.errors.length > 0 };
}

// ── FullCheckReport display components ───────────────────────────────────────

function SectionLabel({ label, color }) {
  return (
    <div style={{ ...LABEL, color, fontSize: "10px", marginBottom: 10 }}>
      {label}
    </div>
  );
}

function DeltaValue({ before, after }) {
  const diff  = after - before;
  const color = diff < 0 ? T.success : diff > 0 ? T.danger : T.warm;
  const label = diff === 0 ? "NO CHANGE" : `${diff > 0 ? "+" : ""}${diff}`;
  return (
    <span style={{ ...NUM, color, fontSize: 13 }}>
      {before} → {after} <span style={{ fontSize: 10 }}>({label})</span>
    </span>
  );
}

function StatusBanner({ before, after, stopped, attempts }) {
  const style = { ...NUM, textAlign: "center", paddingTop: 16, paddingBottom: 4, fontSize: 12 };
  if (after.errors.length === 0)
    return (
      <div style={{ ...style, color: T.success }}>
        ALL CLEAR ✓{after.accepted?.length > 0 && <span style={{ color: "#a0c4d8" }}> · {after.accepted.length} accepted absences</span>}
      </div>
    );
  if (stopped)
    return <div style={{ ...style, color: T.danger }}>Stopped after {attempts} attempt{attempts !== 1 ? "s" : ""} — {after.errors.length} error{after.errors.length !== 1 ? "s" : ""} remain. Open the groups below to review them.</div>;
  if (after.errors.length === before.errors.length)
    return <div style={{ ...style, color: T.warm }}>No change — the remaining errors need manual review.</div>;
  return null;
}

function ManualReviewExpandable({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ width: "100%", background: T.surface, border: "none", padding: "10px 14px", minHeight: 44, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: T.text }}>
        <span style={{ background: T.warm+"20", color: T.warm, border: `1px solid ${T.warm}50`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: MONO, fontWeight: 700 }}>NEEDS MANUAL REVIEW</span>
        <span style={{ ...NUM, color: T.muted, fontSize: 11 }}>{items.length} players</span>
        <span aria-hidden style={{ marginLeft: "auto", color: T.muted, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ background: T.bg }}>
          {items.map((item, i) => (
            <div key={i} style={{ padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{item.playerName}</div>
              <div style={{ ...NUM, color: T.muted, fontSize: 11, marginTop: 2 }}>{item.type} — {item.detail}</div>
              {item.suggestedFix && <div style={{ ...NUM, color: T.muted, opacity:0.6, fontSize: 10, marginTop: 2 }}>{item.suggestedFix}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BeforeSection({ report }) {
  return (
    <>
      <SectionLabel label="Before" color={T.accent} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <StatPill label="Checked"  value={report.checked}         color={T.accent} />
        <StatPill label="Errors"   value={report.errors.length}   color={T.danger} />
        <StatPill label="Warnings" value={report.warnings.length} color={T.warm} />
        {report.accepted?.length > 0 && <StatPill label="Accepted" value={report.accepted.length} color="#a0c4d8" />}
        <StatPill label="Clean"    value={report.clean}           color={T.success} />
      </div>
    </>
  );
}

function FixesSection({ fixReport }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginBottom: 10 }}>
      <SectionLabel label="Fixes applied" color={T.success} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <StatPill label="Resolved"      value={fixReport.resolved}            color={T.success} />
        <StatPill label="Manual review" value={fixReport.manualReview.length} color={T.warm} />
      </div>
      {fixReport.manualReview.length > 0 && <ManualReviewExpandable items={fixReport.manualReview} />}
    </div>
  );
}

function AfterSection({ beforeReport, afterReport, stopped, attempts }) {
  const groupBy = (issues) => issues.reduce((acc, i) => { (acc[i.type] ??= []).push(i); return acc; }, {});
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
      <SectionLabel label="After" color={T.muted} />
      {afterReport.aliasesLoaded > 0 && (
        <div style={{ ...NUM, color: T.accent, fontSize: 10, marginBottom: 10 }}>
          {afterReport.aliasesLoaded} alias{afterReport.aliasesLoaded !== 1 ? "es" : ""} active · {afterReport.aliasesApplied} applied this run
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.danger}30`, borderRadius: 10, padding: "12px 16px", flex: 2, minWidth: 120 }}>
          <div style={{ ...LABEL, color: T.danger, fontSize: "9px", marginBottom: 6 }}>Errors</div>
          <DeltaValue before={beforeReport.errors.length} after={afterReport.errors.length} />
        </div>
        <StatPill label="Warnings" value={afterReport.warnings.length} color={T.warm} />
        <StatPill label="Clean"    value={afterReport.clean}           color={T.success} />
      </div>
      {afterReport.errors.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {Object.entries(groupBy(afterReport.errors)).map(([type, issues]) => (
            <IssueGroup key={type} type={type} issues={issues} isError={true} />
          ))}
        </div>
      )}
      <AcceptedSection accepted={afterReport.accepted} />
      <StatusBanner before={beforeReport} after={afterReport} stopped={stopped} attempts={attempts} />
    </div>
  );
}

function FullCheckReport({ result }) {
  const { beforeReport, fixReport, afterReport, attempts, stopped } = result;
  return (
    <div style={{ paddingTop: 4 }}>
      <BeforeSection report={beforeReport} />
      {fixReport   && <FixesSection fixReport={fixReport} />}
      {afterReport && <AfterSection beforeReport={beforeReport} afterReport={afterReport} stopped={stopped} attempts={attempts} />}
      {!fixReport && beforeReport.errors.length === 0 && (
        <>
          <AcceptedSection accepted={beforeReport.accepted} />
          <div style={{ ...NUM, color: T.success, fontSize: 12, textAlign: "center", paddingTop: 20 }}>
            ALL {beforeReport.checked} PLAYERS CLEAN ✓{beforeReport.accepted?.length > 0 && <span style={{ color: "#a0c4d8" }}> · {beforeReport.accepted.length} accepted absences</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Validator tab ─────────────────────────────────────────────────────────────

function ValidatorPanel({ pushToast }) {
  const [fullCheckResult, setFullCheckResult] = useState(null);
  const [fullChecking,    setFullChecking]    = useState(false);
  const [fullCheckError,  setFullCheckError]  = useState(null);
  const [showManual,      setShowManual]      = useState(false);

  // Manual-controls state (preserved for power users)
  const [report,    setReport]    = useState(null);
  const [running,   setRunning]   = useState(false);
  const [error,     setError]     = useState(null);
  const [fixReport, setFixReport] = useState(null);
  const [fixing,    setFixing]    = useState(false);
  const [fixError,  setFixError]  = useState(null);

  async function runFull() {
    setFullChecking(true); setFullCheckError(null);
    try {
      const result = await runFullCheck();
      setFullCheckResult(result);
      const after = result.afterReport ?? result.beforeReport;
      if (after.errors.length === 0) {
        const acceptedNote = after.accepted?.length > 0 ? ` (${after.accepted.length} accepted absences)` : "";
        pushToast("success", `Full check passed — all ${after.checked} players clean${acceptedNote}.`);
      } else {
        pushToast("error", `Full check stopped with ${after.errors.length} error${after.errors.length !== 1 ? "s" : ""} after ${result.attempts} attempt${result.attempts !== 1 ? "s" : ""} — review the report below.`);
      }
    }
    catch (e) {
      setFullCheckError(e.message || "Full check failed");
      pushToast("error", "Full check failed to run — check your connection and try again.");
    }
    finally { setFullChecking(false); }
  }

  async function run() {
    setRunning(true); setError(null); setFixReport(null);
    try { setReport(await validatePlayerData()); }
    catch (e) { setError(e.message || "Validation failed"); }
    finally { setRunning(false); }
  }

  async function runFix() {
    setFixing(true); setFixError(null);
    try { setFixReport(await fixPlayerData(report)); }
    catch (e) { setFixError(e.message || "Fix failed"); }
    finally { setFixing(false); }
  }

  const groupBy = (issues) => issues.reduce((acc, i) => { (acc[i.type] ??= []).push(i); return acc; }, {});

  return (
    <div style={{ paddingTop: 20 }}>

      {/* ── Primary: RUN FULL CHECK ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={runFull}
          disabled={fullChecking}
          style={{ background: fullChecking ? T.surface : "rgba(0,229,255,0.12)", border: `1px solid ${fullChecking ? T.border : "rgba(0,229,255,0.4)"}`, borderRadius: 8, color: fullChecking ? T.muted : T.accent, fontSize: 12, fontFamily: MONO, fontWeight: 700, padding: "0 16px", minHeight: 44, cursor: fullChecking ? "not-allowed" : "pointer", letterSpacing: "0.1em" }}
        >
          {fullChecking ? "RUNNING…" : "RUN FULL CHECK"}
        </button>
        {fullCheckResult && (
          <span style={{ ...NUM, color: T.muted, opacity:0.7, fontSize: 10 }}>
            {new Date(fullCheckResult.beforeReport.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      {fullCheckError && <div role="alert" style={{ ...NUM, color: T.danger, fontSize: 12, marginBottom: 14 }}>Error: {fullCheckError}</div>}
      {fullCheckResult && <FullCheckReport result={fullCheckResult} />}

      {/* ── Manual Controls (collapsible) ── */}
      <div style={{ marginTop: 28, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <button
          onClick={() => setShowManual(o => !o)}
          aria-expanded={showManual}
          style={{ background: "transparent", border: "none", color: T.muted, ...LABEL, fontSize: "10px", cursor: "pointer", padding: "12px 0", minHeight: 44, display: "flex", alignItems: "center", gap: 8 }}
        >
          Manual controls <span aria-hidden style={{ fontSize: 10 }}>{showManual ? "▲" : "▼"}</span>
        </button>

        {showManual && (
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={run} disabled={running} style={{ background: running ? T.surface : "rgba(0,229,255,0.12)", border: `1px solid ${running ? T.border : "rgba(0,229,255,0.4)"}`, borderRadius: 8, color: running ? T.muted : T.accent, fontSize: 12, fontFamily: MONO, fontWeight: 700, padding: "0 16px", minHeight: 44, cursor: running ? "not-allowed" : "pointer", letterSpacing: "0.1em" }}>
                {running ? "RUNNING…" : "RUN VALIDATION"}
              </button>
              {report?.errors.length > 0 && !fixing && (
                <button onClick={runFix} disabled={fixing} style={{ background: T.surface, border: `1px solid rgba(0,229,255,0.3)`, borderRadius: 8, color: T.success, fontSize: 12, fontFamily: MONO, fontWeight: 700, padding: "0 16px", minHeight: 44, cursor: "pointer", letterSpacing: "0.1em" }}>
                  AUTO-FIX
                </button>
              )}
              {fixing && <span style={{ ...NUM, color: T.success, fontSize: 11 }}>Fixing…</span>}
              {report && <span style={{ ...NUM, color: T.muted, opacity:0.7, fontSize: 10 }}>{new Date(report.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            </div>

            {error    && <div role="alert" style={{ ...NUM, color: T.danger, fontSize: 12, marginBottom: 14 }}>Error: {error}</div>}
            {fixError && <div role="alert" style={{ ...NUM, color: T.danger, fontSize: 12, marginBottom: 14 }}>Fix error: {fixError}</div>}

            {report && (
              <>
                {report.aliasesLoaded > 0 && (
                  <div style={{ ...NUM, color: T.accent, fontSize: 10, marginBottom: 10 }}>
                    {report.aliasesLoaded} alias{report.aliasesLoaded !== 1 ? "es" : ""} active · {report.aliasesApplied} applied this run
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  <StatPill label="Checked"  value={report.checked}         color={T.accent} />
                  <StatPill label="Errors"   value={report.errors.length}   color={T.danger} />
                  <StatPill label="Warnings" value={report.warnings.length} color={T.warm} />
                  {report.accepted?.length > 0 && <StatPill label="Accepted" value={report.accepted.length} color="#a0c4d8" />}
                  <StatPill label="Clean"    value={report.clean}           color={T.success} />
                </div>
                {report.errors.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ ...LABEL, color: T.danger, fontSize: "10px", marginBottom: 10 }}>Errors</div>
                    {Object.entries(groupBy(report.errors)).map(([type, issues]) => (
                      <IssueGroup key={type} type={type} issues={issues} isError={true} />
                    ))}
                  </div>
                )}
                {report.warnings.length > 0 && (
                  <div>
                    <div style={{ ...LABEL, color: T.warm, fontSize: "10px", marginBottom: 10 }}>Warnings</div>
                    {Object.entries(groupBy(report.warnings)).map(([type, issues]) => (
                      <IssueGroup key={type} type={type} issues={issues} isError={false} />
                    ))}
                  </div>
                )}
                <AcceptedSection accepted={report.accepted} />
                {report.errors.length === 0 && report.warnings.length === 0 && (
                  <div style={{ ...NUM, color: T.success, fontSize: 12, textAlign: "center", paddingTop: 20 }}>
                    ALL {report.checked} PLAYERS CLEAN ✓{report.accepted?.length > 0 && <span style={{ color: "#a0c4d8" }}> · {report.accepted.length} accepted absences</span>}
                  </div>
                )}
                {fixReport && <FixReportDisplay fixReport={fixReport} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Landing page ──────────────────────────────────────────────────────────────

const TABS = [{ key: "teams", label: "Teams" }, { key: "validator", label: "Validator" }];

export default function LeagueLanding() {
  const [users,   setUsers]   = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("teams");
  const [toasts,  setToasts]  = useState([]);

  const pushToast = (kind, text) =>
    setToasts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, kind, text }]);
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

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
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, paddingBottom: 60 }}>
      {/* HEADER BAND — compact, ≤200px */}
      <div style={{ background: `linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(123,47,255,0.1) 60%, transparent 100%)`, borderBottom: `1px solid ${T.border}`, padding: "28px 20px 24px" }}>
        <div style={{ ...LABEL, color: T.accent, fontSize: "10px", letterSpacing: "0.22em", marginBottom: 6 }}>Dynasty command center</div>
        <h1 style={{ fontFamily: GEORGIA, fontStyle: "italic", fontWeight: 900, fontSize: "clamp(26px,7vw,38px)", letterSpacing: "-0.02em", color: T.text, lineHeight: 1.05 }}>{LEAGUE_NAME}</h1>
        <div style={{ ...LABEL, color: T.muted, opacity: 0.8, fontSize: "10px", marginTop: 6 }}>Pick your team</div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? T.surface : "transparent", border: "none", borderBottom: `2px solid ${tab === t.key ? T.accent : "transparent"}`, color: tab === t.key ? T.accent : T.muted, padding: "0 20px", minHeight: 44, fontSize: 12, fontFamily: MONO, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 16px", maxWidth: 720, margin: "0 auto" }}>
        {tab === "teams" && (
          <div style={{ paddingTop: 20 }}>
            {loading && Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ marginBottom: 10 }}><Skeleton height="64px" radius="12px"/></div>
            ))}
            {!loading && sorted.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 48 }}>
                <div style={{ fontFamily: GEORGIA, fontStyle: "italic", fontSize: 15, marginBottom: 6 }}>The league didn't load.</div>
                <div style={{ color: T.muted, fontSize: 13 }}>Sleeper may be unreachable — refresh the page to try again.</div>
              </div>
            )}
            {!loading && sorted.map(user => (
              <div key={user.user_id} style={{ marginBottom: 10 }}>
                <TeamCard user={user} record={teamRecord(rosters, user.user_id)} />
              </div>
            ))}
          </div>
        )}
        {tab === "validator" && <ValidatorPanel pushToast={pushToast} />}
      </div>

      <ToastStack items={toasts} onDismiss={dismissToast} theme={T}/>
    </div>
  );
}
