import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LEAGUE_ID   = "1321707192847450112";
const LEAGUE_NAME = "Worm Up Dynasty 🪱🪱🪱";
const SLEEPER_CDN = "https://sleepercdn.com/avatars/thumbs";

function teamRecord(rosters, userId) {
  const r = rosters.find(r => r.owner_id === userId);
  if (!r) return "—";
  const w = r.settings?.wins ?? 0;
  const l = r.settings?.losses ?? 0;
  const t = r.settings?.ties ?? 0;
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}

function TeamCard({ user, record }) {
  const navigate  = useNavigate();
  const teamName  = user.metadata?.team_name || user.display_name || "Unknown Team";
  const avatarUrl = user.avatar ? `${SLEEPER_CDN}/${user.avatar}` : null;

  return (
    <div
      onClick={() => navigate(`/team/${user.user_id}`)}
      style={{
        background: "#0c1828", border: "1px solid #1a2d40", borderRadius: 12,
        padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "#3b82f660";
        e.currentTarget.style.background  = "#0d1e35";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "#1a2d40";
        e.currentTarget.style.background  = "#0c1828";
      }}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid #1a2d40" }} />
        : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1a2d40", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#334155", fontSize: 18 }}>🏈</span>
          </div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {teamName}
        </div>
        <div style={{ color: "#334155", fontSize: 10, fontFamily: "'Space Mono',monospace", marginTop: 3 }}>
          {user.display_name} · {record}
        </div>
      </div>
      <span style={{ color: "#1e3a5f", fontSize: 16, flexShrink: 0 }}>›</span>
    </div>
  );
}

export default function LeagueLanding() {
  const [users,   setUsers]   = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);

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
      } catch {
        /* show whatever loaded */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sorted = [...users].sort((a, b) => {
    const nameA = (a.metadata?.team_name || a.display_name || "").toLowerCase();
    const nameB = (b.metadata?.team_name || b.display_name || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div style={{ minHeight: "100vh", background: "#060d16", color: "#e2e8f0", fontFamily: "'DM Sans',sans-serif", paddingBottom: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');* { box-sizing:border-box; margin:0; }`}</style>

      <div style={{
        background: "linear-gradient(135deg,#08152a 0%,#0c1e3d 60%,#08152a 100%)",
        borderBottom: "1px solid #1a3050", padding: "32px 20px 28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "linear-gradient(#3b82f6 1px,transparent 1px),linear-gradient(90deg,#3b82f6 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        <div style={{ position: "relative" }}>
          <div style={{ color: "#3b82f6", fontSize: 10, fontFamily: "'Space Mono',monospace", letterSpacing: "0.22em", marginBottom: 6 }}>DYNASTY COMMAND CENTER</div>
          <h1 style={{ fontSize: 40, fontFamily: "'Bebas Neue',cursive", letterSpacing: "0.06em", color: "#f1f5f9", lineHeight: 1 }}>{LEAGUE_NAME}</h1>
          <div style={{ color: "#1e3a5f", fontSize: 11, fontFamily: "'Space Mono',monospace", marginTop: 6 }}>SELECT YOUR TEAM</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {loading && (
          <div style={{ color: "#334155", fontSize: 11, fontFamily: "'Space Mono',monospace", textAlign: "center", paddingTop: 40 }}>LOADING TEAMS...</div>
        )}
        {!loading && sorted.map(user => (
          <div key={user.user_id} style={{ marginBottom: 10 }}>
            <TeamCard user={user} record={teamRecord(rosters, user.user_id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
