import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DropdownProps {
  trigger: React.ReactNode | ((props: { isOpen: boolean; toggle: () => void }) => React.ReactNode);
  children: React.ReactNode | ((props: { close: () => void }) => React.ReactNode);
  align?: "left" | "right";
  width?: number | string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function Dropdown({
  trigger,
  children,
  align = "left",
  width,
  isOpen: controlledOpen,
  onOpenChange,
  className = "",
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const containerRef = useRef<HTMLDivElement>(null);

  function setOpen(open: boolean) {
    if (!isControlled) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  }

  function toggle() {
    setOpen(!isOpen);
  }

  function close() {
    setOpen(false);
  }

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`dropdown-root ${className}`}
      style={{ position: "relative", display: "inline-block" }}
    >
      {typeof trigger === "function" ? trigger({ isOpen, toggle }) : (
        <div onClick={toggle} style={{ cursor: "pointer" }}>
          {trigger}
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              [align]: 0,
              width: width || "max-content",
              minWidth: 160,
              maxWidth: "min(92vw, 380px)",
              zIndex: "var(--z-dropdown, 200)" as any,
              background: "var(--panel-strong)",
              borderRadius: "var(--radius, 12px)",
              border: "1px solid var(--panel-border)",
              boxShadow: "0 14px 42px rgba(0, 0, 0, 0.65), 0 0 16px rgba(79, 217, 208, 0.08)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              overflow: "hidden",
            }}
            className="dropdown-menu panel"
            role="menu"
          >
            {typeof children === "function" ? children({ close }) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
