/**
 * DataTable — consumer copy for legion-dynasty-dashboard.
 * Source of truth: ~/.claude/skills/design/references/components/app/DataTable.tsx
 * (2026-07-13, incl. the 44px sort-header tap-zone fix). Adaptations:
 * TS types + "use client" dropped; columns gain optional `render(row)` (rich
 * cells — headshots/badges keep their anatomy inside table semantics, per
 * Phase 2 critique) and `sortValue(row)` (sort key when the cell isn't the
 * raw value); optional `onRowClick`; `maxHeight` prop (roster lists run
 * longer than the kit's 420px default); optional `initialSort`.
 */
import { useState } from "react";
import { LABEL, NUM } from "./theme";
import { Skeleton } from "./Skeleton";

export function DataTable({ columns, rows, loading = false, emptyTitle = "Nothing here yet", emptyBody, emptyAction, onRowClick, maxHeight = "none", initialSort = null, theme }) {
  const [sortKey, setSortKey] = useState(initialSort);
  const [asc, setAsc] = useState(false);
  const col = (key) => columns.find(c => c.key === key);
  const valueOf = (row, c) => (c?.sortValue ? c.sortValue(row) : row[c?.key]);
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const c = col(sortKey);
        const x = valueOf(a, c), y = valueOf(b, c);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return asc ? cmp : -cmp;
      })
    : rows;
  const onSort = (key) => {
    if (sortKey === key) setAsc(!asc); else { setSortKey(key); setAsc(false); }
  };
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "auto", maxHeight, background: theme.surface }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: theme.text }}>
        <thead>
          <tr>
            {/* sortable header: th padding moves onto the button so the tap zone is the full 44px cell */}
            {columns.map(c => (
              <th key={c.key} style={{ position: "sticky", top: 0, background: theme.bg, borderBottom: `1px solid ${theme.border}`, padding: c.sortable ? 0 : "10px 14px", textAlign: c.numeric ? "right" : "left", zIndex: 1 }}>
                {c.sortable ? (
                  <button onClick={() => onSort(c.key)} style={{ ...LABEL, color: sortKey === c.key ? theme.accent : theme.muted, background: "none", border: "none", cursor: "pointer", padding: "10px 14px", minHeight: "44px", width: "100%", display: "block", textAlign: c.numeric ? "right" : "left" }}>
                    {c.label} <span style={{ fontSize: "9px", opacity: sortKey === c.key ? 1 : 0.3 }}>{sortKey === c.key && asc ? "▲" : "▼"}</span>
                  </button>
                ) : (
                  <span style={{ ...LABEL, color: theme.muted }}>{c.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 4 }, (_, i) => (
            <tr key={`sk-${i}`}>
              {columns.map(c => <td key={c.key} style={{ padding: "14px" }}><Skeleton height="14px"/></td>)}
            </tr>
          ))}
          {!loading && sorted.map((r, i) => (
            <tr key={r.id ?? i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {columns.map(c => (
                <td key={c.key} style={{ padding: "10px 14px", minHeight: "44px", height: "44px", borderBottom: `1px solid ${theme.border}`, textAlign: c.numeric ? "right" : "left", ...(c.numeric ? NUM : {}) }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "15px", color: theme.text, marginBottom: "6px", fontFamily: "Georgia,serif", fontStyle: "italic" }}>{emptyTitle}</div>
                {emptyBody && <div style={{ fontSize: "13px", color: theme.muted, marginBottom: "14px" }}>{emptyBody}</div>}
                {emptyAction}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
