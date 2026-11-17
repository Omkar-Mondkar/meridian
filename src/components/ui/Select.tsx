import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  menuWidth?: number | string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  size = "md",
  disabled = false,
  className = "",
  style = {},
  menuWidth,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = options.findIndex((o) => o.value === value);
        const next = options[(currentIndex + 1) % options.length];
        if (next && !next.disabled) onChange(next.value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = options.findIndex((o) => o.value === value);
        const prev = options[(currentIndex - 1 + options.length) % options.length];
        if (prev && !prev.disabled) onChange(prev.value);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, options, value, onChange]);

  const height = size === "sm" ? 30 : 38;
  const fontSize = size === "sm" ? 11.5 : 13;
  const padding = size === "sm" ? "4px 10px" : "8px 12px";

  return (
    <div
      ref={containerRef}
      className={`select-container ${className}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        ...style,
      }}
    >
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          height,
          padding,
          fontSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "var(--panel-strong)",
          border: `1px solid ${isOpen ? "var(--cyan)" : "var(--panel-border)"}`,
          borderRadius: 8,
          color: selectedOption ? "var(--text-hi)" : "var(--text-lo)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          boxShadow: isOpen ? "0 0 10px rgba(79, 217, 208, 0.2)" : "none",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          textAlign: "left",
          outline: "none",
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", minWidth: 0 }}>
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{selectedOption.icon}</span>
          )}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge}
        </div>

        {/* Animated Chevron */}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "var(--text-lo)",
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              width: menuWidth || "100%",
              minWidth: "100%",
              maxHeight: 240,
              overflowY: "auto",
              zIndex: "var(--z-dropdown, 200)" as any,
              background: "var(--panel-strong)",
              borderRadius: 8,
              border: "1px solid var(--panel-border)",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.7), 0 0 16px rgba(79, 217, 208, 0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 4,
            }}
            role="listbox"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: size === "sm" ? "5px 8px" : "8px 10px",
                    borderRadius: 6,
                    fontSize,
                    cursor: option.disabled ? "not-allowed" : "pointer",
                    opacity: option.disabled ? 0.4 : 1,
                    background: isSelected ? "rgba(79, 217, 208, 0.12)" : "transparent",
                    color: isSelected ? "var(--cyan)" : "var(--text-hi)",
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !option.disabled) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !option.disabled) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {option.icon && (
                      <span style={{ display: "inline-flex", flexShrink: 0 }}>{option.icon}</span>
                    )}
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{option.label}</span>
                    {option.badge}
                  </div>

                  {isSelected && (
                    <span style={{ color: "var(--cyan)", display: "inline-flex", alignItems: "center" }}>
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
