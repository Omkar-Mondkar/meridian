import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  level?: "primary" | "confirm";
  className?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

// Module-level counter to safely manage nested modal scroll locks
let openModalsCount = 0;

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
  level = "primary",
  className = "",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Manage body scroll locking across multiple stacked modals
  useEffect(() => {
    if (isOpen) {
      openModalsCount++;
      if (openModalsCount === 1) {
        document.body.style.overflow = "hidden";
      }
    }
    return () => {
      if (isOpen) {
        openModalsCount = Math.max(0, openModalsCount - 1);
        if (openModalsCount === 0) {
          document.body.style.overflow = "";
        }
      }
    };
  }, [isOpen]);

  // Handle keyboard Escape
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (typeof document === "undefined") return null;

  const isConfirm = level === "confirm";
  const zIndexBackdrop = isConfirm
    ? "var(--z-modal-confirm-backdrop, 1100)"
    : "var(--z-modal-backdrop, 1000)";
  const zIndexDialog = isConfirm
    ? "var(--z-modal-confirm, 1110)"
    : "var(--z-modal, 1010)";

  // Width mapping by size prop
  const maxWidthMap: Record<NonNullable<ModalProps["size"]>, string | number> = {
    sm: 440,
    md: 620,
    lg: 840,
    xl: 1100,
    full: "96vw",
  };

  const maxWidth = maxWidthMap[size] || 620;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: zIndexBackdrop as any,
            backgroundColor: isConfirm
              ? "rgba(1, 3, 8, 0.82)"
              : "rgba(2, 5, 12, 0.76)",
            backdropFilter: "blur(12px) saturate(140%)",
            WebkitBackdropFilter: "blur(12px) saturate(140%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            boxSizing: "border-box",
          }}
          onClick={(e) => {
            if (closeOnBackdropClick && e.target === e.currentTarget) {
              onClose();
            }
          }}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            key="modal-dialog"
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "relative",
              zIndex: zIndexDialog as any,
              width: "100%",
              maxWidth: size === "full" ? "96vw" : maxWidth,
              maxHeight: size === "full" ? "96vh" : "90vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--panel-strong)",
              borderRadius: "var(--radius, 14px)",
              border: isConfirm
                ? "1px solid rgba(255, 176, 32, 0.35)"
                : "1px solid var(--panel-border)",
              boxShadow: isConfirm
                ? "0 28px 72px rgba(0, 0, 0, 0.85), 0 0 32px rgba(255, 176, 32, 0.15)"
                : "0 24px 64px rgba(0, 0, 0, 0.8), 0 0 28px rgba(79, 217, 208, 0.1)",
              overflow: "hidden",
            }}
            className={`modal-dialog ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 22px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderBottom: "1px solid var(--panel-border)",
                  flexShrink: 0,
                  gap: 12,
                }}
                className="modal-header"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {icon && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: isConfirm ? "var(--amber)" : "var(--cyan)",
                      }}
                    >
                      {icon}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    {typeof title === "string" ? (
                      <h2
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text-hi)",
                          letterSpacing: "0.02em",
                          margin: 0,
                          lineHeight: 1.3,
                        }}
                      >
                        {title}
                      </h2>
                    ) : (
                      title
                    )}
                    {subtitle && (
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-lo)",
                          margin: "2px 0 0",
                          lineHeight: 1.3,
                        }}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: "1px solid var(--panel-border)",
                      background: "rgba(255, 255, 255, 0.04)",
                      color: "var(--text-lo)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 14,
                      transition: "all 0.18s ease",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--red)";
                      e.currentTarget.style.borderColor = "rgba(255, 77, 94, 0.4)";
                      e.currentTarget.style.background = "rgba(255, 77, 94, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-lo)";
                      e.currentTarget.style.borderColor = "var(--panel-border)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
              }}
              className="modal-body"
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                style={{
                  padding: "14px 22px",
                  background: "rgba(0, 0, 0, 0.25)",
                  borderTop: "1px solid var(--panel-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexShrink: 0,
                }}
                className="modal-footer"
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
