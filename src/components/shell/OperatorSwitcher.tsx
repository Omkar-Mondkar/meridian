import React, { useState, useRef, useEffect } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useTaskStore } from "../../stores/useTaskStore";
import { getPersonasForShift, type Persona } from "../../data/personas";

export function OperatorSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentUser, currentUserId, currentGroups, allUsers, allGroups, setCurrentUser } = usePermissions();
  const setPersona = useTaskStore((s) => s.setPersona);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function getRoleIcon(userRole: string, groupIds: string[]): string {
    if (groupIds.includes("grp_admins")) return "🛡️";
    if (groupIds.includes("grp_supervisors")) return "⚡";
    if (groupIds.includes("grp_l2_engineers")) return "🔧";
    if (groupIds.includes("grp_l1_operators")) return "📋";
    return "👁️";
  }

  function getGroupBadgeColor(groupId: string): { bg: string; text: string; border: string } {
    switch (groupId) {
      case "grp_admins":
        return { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.35)" };
      case "grp_supervisors":
        return { bg: "rgba(234, 179, 8, 0.15)", text: "#facc15", border: "rgba(234, 179, 8, 0.35)" };
      case "grp_l2_engineers":
        return { bg: "rgba(79, 217, 208, 0.15)", text: "var(--cyan)", border: "rgba(79, 217, 208, 0.35)" };
      case "grp_l1_operators":
        return { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.35)" };
      case "grp_viewers":
      default:
        return { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" };
    }
  }

  function handleSelect(userId: string) {
    setCurrentUser(userId);
    setIsOpen(false);

    // Sync legacy persona store if matching persona exists
    const selected = allUsers.find((u) => u.id === userId);
    if (selected) {
      const allPersonas = getPersonasForShift("Morning").all;
      const matched = allPersonas.find(
        (p: Persona) =>
          p.name.toLowerCase().includes(selected.displayName.toLowerCase()) ||
          selected.displayName.toLowerCase().includes(p.name.toLowerCase())
      );
      if (matched) {
        setPersona(matched);
      } else {
        setPersona({
          name: selected.displayName,
          role: selected.roleTitle,
          rbacRole: selected.groupIds.includes("grp_admins")
            ? "Admin"
            : selected.groupIds.includes("grp_supervisors")
            ? "Shift Lead"
            : selected.groupIds.includes("grp_l2_engineers")
            ? "L2 Support"
            : "L1 Support",
          gender: "m",
          variant: selected.groupIds.includes("grp_admins") ? "executive" : "formal",
        });
      }
    }
  }

  const primaryGroup = currentGroups[0];
  const groupStyle = primaryGroup ? getGroupBadgeColor(primaryGroup.id) : getGroupBadgeColor("grp_viewers");
  const userIcon = getRoleIcon(currentUser?.roleTitle || "", currentUser?.groupIds || []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        id="operatorSwitcherBtn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Switch active operational user and RBAC permissions"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          borderRadius: 8,
          background: isOpen ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${isOpen ? "rgba(79, 217, 208, 0.5)" : "rgba(255, 255, 255, 0.12)"}`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          outline: "none",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: groupStyle.bg,
            border: `1px solid ${groupStyle.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
          }}
        >
          {userIcon}
        </div>

        <div style={{ textAlign: "left", display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-hi)", letterSpacing: "0.02em" }}>
            {currentUser?.displayName || "Operator"}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: groupStyle.text,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {primaryGroup?.name || "Viewer"}
          </span>
        </div>

        <span
          style={{
            fontSize: 10,
            color: "var(--text-lo)",
            marginLeft: 2,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "#080d16",
            border: "1px solid rgba(79, 217, 208, 0.3)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(79, 217, 208, 0.1)",
            zIndex: 1000,
            overflow: "hidden",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(255, 255, 255, 0.02)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--cyan)" }}>
                OPERATOR PROFILE SWITCHER
              </div>
              <div style={{ fontSize: 10, color: "var(--text-lo)", marginTop: 2 }}>
                Inherited group permissions apply dynamically
              </div>
            </div>
            <span style={{ fontSize: 13 }}>🔐</span>
          </div>

          {/* User List */}
          <div style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
            {allUsers.map((user) => {
              const isSelected = user.id === currentUserId;
              const userGroups = allGroups.filter((g) => user.groupIds.includes(g.id));
              const mainGroup = userGroups[0];
              const badge = mainGroup ? getGroupBadgeColor(mainGroup.id) : getGroupBadgeColor("grp_viewers");
              const icon = getRoleIcon(user.roleTitle, user.groupIds);

              return (
                <div
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 7,
                    cursor: "pointer",
                    background: isSelected ? "rgba(79, 217, 208, 0.1)" : "transparent",
                    border: `1px solid ${isSelected ? "rgba(79, 217, 208, 0.35)" : "transparent"}`,
                    marginBottom: 3,
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255, 255, 255, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isSelected ? "var(--cyan)" : "var(--text-hi)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {user.displayName}
                      </span>
                      {mainGroup && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {mainGroup.name}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-lo)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: 2,
                      }}
                    >
                      {user.roleTitle}
                    </div>
                  </div>

                  {isSelected && (
                    <span style={{ color: "var(--cyan)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer showing permissions count */}
          <div
            style={{
              padding: "7px 12px",
              background: "rgba(0, 0, 0, 0.3)",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              fontSize: 10,
              color: "var(--text-lo)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Active: {currentUser?.username}</span>
            <span style={{ color: "var(--cyan)" }}>
              {currentGroups.map((g) => g.permissions).flat().length} Permissions Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
