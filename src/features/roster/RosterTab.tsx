import React from "react";
import {
  PERSONNEL,
  LEADERSHIP,
  dutyState,
  isHandover,
  currentShiftName,
} from "../../data/roster";
import { useTimeStore } from "../../stores/useTimeStore";
import { DutyPill } from "../../components/ui/DutyPill";
import { Avatar } from "./Avatar";
import { Panel } from "../../components/ui/Panel";

export function RosterTab() {
  const { nowMin } = useTimeStore();
  const curShift = currentShiftName(nowMin);
  const handover = isHandover(nowMin);

  const principal = LEADERSHIP.find((l) => l.level === "principal");
  const teamLeader = LEADERSHIP.find((l) => l.level === "team_leader");

  return (
    <section
      className="view"
      id="view-roster"
      role="tabpanel"
      aria-labelledby="tab-roster"
    >
      <div className="roster-container">
        {/* ── Top Leadership & Command Hierarchy ── */}
        <Panel className="leadership-panel">
          <div className="leadership-header">
            <div>
              <div className="leadership-tag">
                <span className="lead-badge-dot" />
                COMMAND & ESCALATION HIERARCHY
              </div>
              <div className="leadership-subtitle">
                Unified 24×5 Production Support Team Structure
              </div>
            </div>
            <div className="desk-stats-chip">
              <span className="dot" />
              <span>Full Desk Strength: 13 Members</span>
            </div>
          </div>

          <div className="hierarchy-tree">
            {/* Level 1: Principal */}
            {principal && (
              <div className="hierarchy-tier tier-principal">
                <div className="tier-badge principal-badge">
                  <span className="crown-icon">👑</span> PRINCIPAL
                </div>
                <div className="leader-card principal-card">
                  <div className="leader-avatar-wrap">
                    <Avatar
                      gender={principal.gender}
                      variant="executive"
                      size={46}
                    />
                    <span className="executive-ring" />
                  </div>
                  <div className="leader-info">
                    <div className="leader-name-row">
                      <span className="leader-name">{principal.name}</span>
                      <span className="leader-status-pill principal-status">
                        {principal.statusLabel || "DESK HEAD"}
                      </span>
                    </div>
                    <div className="leader-role">{principal.role}</div>
                    <div className="leader-meta">
                      <span className="meta-tag">
                        🛡 {principal.coverage || "24×7 Escalation"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Connecting Flow Line */}
            <div className="hierarchy-connector">
              <div className="connector-line" />
              <div className="connector-label">DIRECT REPORTING</div>
              <div className="connector-line" />
            </div>

            {/* Level 2: Team Leader */}
            {teamLeader && (
              <div className="hierarchy-tier tier-lead">
                <div className="tier-badge lead-badge">
                  <span className="badge-icon">🎖</span> TEAM LEADER
                </div>
                <div className="leader-card lead-card">
                  <div className="leader-avatar-wrap">
                    <Avatar
                      gender={teamLeader.gender}
                      variant="formal"
                      size={44}
                    />
                    <span className="formal-ring" />
                  </div>
                  <div className="leader-info">
                    <div className="leader-name-row">
                      <span className="leader-name">{teamLeader.name}</span>
                      <span className="leader-status-pill lead-status">
                        {teamLeader.statusLabel || "OPS LEAD"}
                      </span>
                    </div>
                    <div className="leader-role">{teamLeader.role}</div>
                    <div className="leader-meta">
                      <span className="meta-tag">
                        ⚡ {teamLeader.coverage || "All-Shift Coordination"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Connecting Flow Line to Shifts */}
            <div className="hierarchy-connector shift-connector">
              <div className="connector-line" />
              <div className="connector-label">
                OPERATIONAL ROTATION (3 SHIFTS · 24×5 CONTINUOUS)
              </div>
              <div className="connector-line" />
            </div>
          </div>
        </Panel>

        {/* ── 3 Rotational Shift Columns ── */}
        <div className="shifts-section-header">
          <div className="shifts-title">ROTATIONAL SHIFT ROSTER</div>
          <div className="shifts-legend">
            <span className="legend-item">
              <span className="dot on" /> On Duty
            </span>
            <span className="legend-item">
              <span className="dot up" /> Upcoming
            </span>
            <span className="legend-item">
              <span className="dot off" /> Off Shift
            </span>
          </div>
        </div>

        <div className="roster-grid" id="rosterGrid">
          {Object.entries(PERSONNEL).map(([shiftName, data]) => {
            const state = dutyState(shiftName, nowMin);
            const isCurrent = shiftName === curShift;
            return (
              <Panel
                key={shiftName}
                className={`shift-col${isCurrent ? " current-shift" : ""}`}
              >
                <div className="shift-head">
                  <span className="shift-name">{shiftName} Shift</span>
                  <span className="shift-window mono">{data.window}</span>
                </div>
                {isCurrent && (
                  <div className="current-shift-ribbon">Current Live Shift</div>
                )}
                {handover && state === "on" && (
                  <div className="handover-ribbon">Handover in progress</div>
                )}
                <div className="shift-people-list">
                  {data.people.map((p) => (
                    <div key={p.name} className="person">
                      <Avatar gender={p.gender} variant="standard" size={38} />
                      <div className="person-info">
                        <div className="person-name">{p.name}</div>
                        <div className="person-role">{p.role}</div>
                      </div>
                      <DutyPill state={state} />
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </section>
  );
}
