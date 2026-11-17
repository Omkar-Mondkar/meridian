import React from "react";
import { getPersonasForTasks, type Persona } from "../../data/personas";
import type { ShiftKey } from "../../data/roster";
import { Avatar } from "../roster/Avatar";
import { Dropdown } from "../../components/ui/Dropdown";
import { motion } from "framer-motion";
import { User, Crown, Clock, Check, ChevronDown } from "lucide-react";

interface PersonaDropdownProps {
  selectedShift: ShiftKey;
  currentPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
}

export function PersonaDropdown({
  selectedShift,
  currentPersona,
  onSelectPersona,
}: PersonaDropdownProps) {
  const { leadership, shiftMembers } = getPersonasForTasks(selectedShift);

  function getRbacClass(rbac: string) {
    if (rbac === "Admin") return "rbac-admin";
    if (rbac === "Shift Lead") return "rbac-lead";
    if (rbac === "L2 Support") return "rbac-l2";
    return "rbac-l1";
  }

  return (
    <div className="persona-dropdown-container">
      <div className="persona-label">
        <User size={13} className="persona-label-icon" />
        <span>ACTING AS</span>
      </div>

      <Dropdown
        align="left"
        width={340}
        trigger={({ isOpen, toggle }) => (
          <button
            type="button"
            className={`persona-trigger-btn ${isOpen ? "open" : ""}`}
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <div className="trigger-avatar">
              <Avatar
                gender={currentPersona.gender}
                variant={currentPersona.variant || "standard"}
                size={28}
              />
            </div>
            <div className="trigger-info">
              <div className="trigger-name">{currentPersona.name}</div>
              <div className="trigger-role">
                <span className="designation-text">{currentPersona.role}</span>
                <span className={`rbac-pill ${getRbacClass(currentPersona.rbacRole)}`}>
                  {currentPersona.rbacRole}
                </span>
              </div>
            </div>
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "var(--text-lo)",
                marginLeft: 2,
              }}
            >
              <ChevronDown size={13} />
            </motion.span>
          </button>
        )}
      >
        {({ close }) => (
          <div style={{ padding: 8, width: "100%" }} role="listbox">
            {/* Section 1: Leadership */}
            <div className="persona-group-header">
              <Crown size={12} className="group-icon" style={{ color: "var(--amber)" }} />
              <span>DESK LEADERSHIP (ALL SHIFTS)</span>
            </div>
            <div className="persona-group">
              {leadership.map((p) => {
                const isSelected = p.name === currentPersona.name;
                return (
                  <div
                    key={p.name}
                    className={`persona-option ${isSelected ? "selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectPersona(p);
                      close();
                    }}
                  >
                    <div className="option-avatar">
                      <Avatar
                        gender={p.gender}
                        variant={p.variant || "standard"}
                        size={26}
                      />
                    </div>
                    <div className="option-details">
                      <div className="option-name">{p.name}</div>
                      <div className="option-designation">{p.role}</div>
                    </div>
                    <span className={`rbac-pill ${getRbacClass(p.rbacRole)}`}>
                      {p.rbacRole}
                    </span>
                    {isSelected && (
                      <Check size={14} className="option-checkmark" style={{ color: "var(--amber)" }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section 2: Current Shift Members */}
            <div className="persona-group-header shift-header">
              <Clock size={12} className="group-icon" style={{ color: "var(--cyan)" }} />
              <span>{selectedShift.toUpperCase()} SHIFT TEAM</span>
            </div>
            <div className="persona-group">
              {shiftMembers.length > 0 ? (
                shiftMembers.map((p) => {
                  const isSelected = p.name === currentPersona.name;
                  return (
                    <div
                      key={p.name}
                      className={`persona-option ${isSelected ? "selected" : ""}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectPersona(p);
                        close();
                      }}
                    >
                      <div className="option-avatar">
                        <Avatar
                          gender={p.gender}
                          variant={p.variant || "standard"}
                          size={26}
                        />
                      </div>
                      <div className="option-details">
                        <div className="option-name">{p.name}</div>
                        <div className="option-designation">{p.role}</div>
                      </div>
                      <span className={`rbac-pill ${getRbacClass(p.rbacRole)}`}>
                        {p.rbacRole}
                      </span>
                      {isSelected && (
                        <Check size={14} className="option-checkmark" style={{ color: "var(--cyan)" }} />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="persona-empty">No roster members found</div>
              )}
            </div>
          </div>
        )}
      </Dropdown>
    </div>
  );
}
