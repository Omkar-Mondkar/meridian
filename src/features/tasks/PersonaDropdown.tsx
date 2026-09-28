import React, { useState, useRef, useEffect } from "react";
import { getPersonasForTasks, type Persona } from "../../data/personas";
import type { ShiftKey } from "../../data/roster";
import { Avatar } from "../roster/Avatar";

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { leadership, shiftMembers } = getPersonasForTasks(selectedShift);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  function getRbacClass(rbac: string) {
    if (rbac === "Admin") return "rbac-admin";
    if (rbac === "Shift Lead") return "rbac-lead";
    if (rbac === "L2 Support") return "rbac-l2";
    return "rbac-l1";
  }

  return (
    <div className="persona-dropdown-container" ref={dropdownRef}>
      <div className="persona-label">
        <span className="persona-label-icon">👤</span>
        <span>ACTING AS</span>
      </div>

      <button
        type="button"
        className={`persona-trigger-btn ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
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
        <span className={`trigger-chevron ${isOpen ? "rotated" : ""}`}>▾</span>
      </button>

      {isOpen && (
        <div className="persona-menu panel" role="listbox">
          {/* Section 1: Leadership */}
          <div className="persona-group-header">
            <span className="group-icon">👑</span>
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
                    setIsOpen(false);
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
                  {isSelected && <span className="option-checkmark">✓</span>}
                </div>
              );
            })}
          </div>

          {/* Section 2: Current Shift Members */}
          <div className="persona-group-header shift-header">
            <span className="group-icon">🕒</span>
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
                      setIsOpen(false);
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
                    {isSelected && <span className="option-checkmark">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="persona-empty">No roster members found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
