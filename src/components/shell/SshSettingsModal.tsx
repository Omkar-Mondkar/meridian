import React, { useState, useEffect } from "react";
import { useTaskStore } from "../../stores/useTaskStore";
import { usePermissions } from "../../hooks/usePermissions";
import { syncClient } from "../../lib/syncClient";

interface SshSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PublicSshSettings {
  host: string;
  port: number;
  username: string;
  authType: "password" | "privateKey";
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export function SshSettingsModal({ isOpen, onClose }: SshSettingsModalProps) {
  const { currentPersona } = useTaskStore();
  const { canManageVault } = usePermissions();
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState<"password" | "privateKey">("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const [existingSettings, setExistingSettings] = useState<PublicSshSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  async function loadSettings() {
    setLoading(true);
    setErrorMsg("");
    setSaveSuccess(false);
    setTestResult(null);
    try {
      const res = await fetch("http://localhost:3001/api/settings/ssh", {
        headers: { ...syncClient.getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setExistingSettings(data.settings);
          setHost(data.settings.host || "");
          setPort(data.settings.port || 22);
          setUsername(data.settings.username || "");
          setAuthType(data.settings.authType || "password");
        }
      }
    } catch (err: unknown) {
      console.warn("Could not load SSH settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    if (!canManageVault) {
      setTestResult({ success: false, error: "Testing SSH connections requires System Admin permissions (ssh:manage_vault)" });
      return;
    }
    if (!host.trim() || !username.trim()) {
      setErrorMsg("Host and Username are required to test connection.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setErrorMsg("");

    try {
      const payload: Record<string, any> = {
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        authType,
      };

      if (authType === "password" && password) {
        payload.password = password;
      }
      if (authType === "privateKey" && privateKey) {
        payload.privateKey = privateKey;
        if (passphrase) payload.passphrase = passphrase;
      }

      const res = await fetch("http://localhost:3001/api/settings/ssh/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...syncClient.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ success: false, error: `Network error: ${msg}` });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageVault) {
      setErrorMsg("Modifying SSH vault credentials requires System Admin permissions (ssh:manage_vault)");
      return;
    }
    if (!host.trim() || !username.trim()) {
      setErrorMsg("Host and Username are required.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSaveSuccess(false);

    try {
      const payload: Record<string, any> = {
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        authType,
        operator: currentPersona.name,
      };

      if (authType === "password" && password) {
        payload.password = password;
      }
      if (authType === "privateKey" && privateKey) {
        payload.privateKey = privateKey;
        if (passphrase) payload.passphrase = passphrase;
      }

      const res = await fetch("http://localhost:3001/api/settings/ssh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...syncClient.getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setExistingSettings(data.settings);
        setSaveSuccess(true);
        setPassword("");
        setPrivateKey("");
        setPassphrase("");
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to save SSH credentials");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Failed to save: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 18, 0.82)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--panel-strong)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 620,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(79, 217, 208, 0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, color: "var(--cyan)" }}>⚡</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-hi)", letterSpacing: "0.02em" }}>
                Central Reporting Server · SSH Vault
              </h2>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-lo)", marginTop: 4 }}>
              Encrypted connection to the master aggregation host monitoring 200+ servers
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              color: "var(--text-lo)",
              fontSize: 16,
              padding: "6px 10px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.05)",
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleSave}
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {errorMsg && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255, 77, 94, 0.12)",
                border: "1px solid rgba(255, 77, 94, 0.35)",
                borderRadius: 8,
                color: "var(--red)",
                fontSize: 12,
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}

          {saveSuccess && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(51, 209, 122, 0.12)",
                border: "1px solid rgba(51, 209, 122, 0.35)",
                borderRadius: 8,
                color: "var(--green)",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ✓ SSH credentials encrypted and saved securely to MongoDB vault!
            </div>
          )}

          {!canManageVault && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                borderRadius: 8,
                color: "#facc15",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>🔒</span>
              <span>
                <strong>Read-Only Vault View:</strong> Modifying credentials or testing SSH handshakes requires System Admin privileges (<code>ssh:manage_vault</code>).
              </span>
            </div>
          )}

          {/* Host & Port */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                CENTRAL SERVER HOST / IP *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., 10.200.1.50 or reports.prod.internal"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 8,
                  color: "var(--text-hi)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                PORT *
              </label>
              <input
                type="number"
                required
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 8,
                  color: "var(--text-hi)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 6, fontWeight: 600 }}>
              SSH USERNAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., ops_meridian or service_account"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                color: "var(--text-hi)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Auth Method Radio */}
          <div>
            <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 8, fontWeight: 600 }}>
              AUTHENTICATION METHOD
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setAuthType("password")}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: authType === "password" ? "1px solid var(--cyan)" : "1px solid rgba(255, 255, 255, 0.12)",
                  background: authType === "password" ? "rgba(79, 217, 208, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  color: authType === "password" ? "var(--cyan)" : "var(--text-lo)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>🔑</span> Password Authentication
              </button>

              <button
                type="button"
                onClick={() => setAuthType("privateKey")}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: authType === "privateKey" ? "1px solid var(--cyan)" : "1px solid rgba(255, 255, 255, 0.12)",
                  background: authType === "privateKey" ? "rgba(79, 217, 208, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  color: authType === "privateKey" ? "var(--cyan)" : "var(--text-lo)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>🛡</span> Private Key (Ed25519 / RSA)
              </button>
            </div>
          </div>

          {/* Password Input */}
          {authType === "password" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: "var(--text-lo)", fontWeight: 600 }}>PASSWORD</label>
                {existingSettings?.hasPassword && (
                  <span style={{ fontSize: 11, color: "var(--green)" }}>● Password currently stored in vault</span>
                )}
              </div>
              <input
                type="password"
                placeholder={existingSettings?.hasPassword ? "•••••••••••• (Leave blank to keep existing password)" : "Enter SSH account password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 8,
                  color: "var(--text-hi)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 13,
                }}
              />
            </div>
          )}

          {/* Private Key Input */}
          {authType === "privateKey" && (
            <>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: "var(--text-lo)", fontWeight: 600 }}>PRIVATE KEY (PEM / OPENSSH)</label>
                  {existingSettings?.hasPrivateKey && (
                    <span style={{ fontSize: 11, color: "var(--green)" }}>● Key currently stored in vault</span>
                  )}
                </div>
                <textarea
                  rows={4}
                  placeholder={existingSettings?.hasPrivateKey ? "[Private key saved in AES-256 vault. Paste new key to replace]" : "-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 8,
                    color: "var(--text-hi)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 11,
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-lo)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  KEY PASSPHRASE (OPTIONAL)
                </label>
                <input
                  type="password"
                  placeholder={existingSettings?.hasPassphrase ? "•••••••• (Leave blank to keep existing passphrase)" : "Passphrase if key is encrypted"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 8,
                    color: "var(--text-hi)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 13,
                  }}
                />
              </div>
            </>
          )}

          {/* Test Handshake Feedback */}
          {testResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: testResult.success ? "rgba(51, 209, 122, 0.1)" : "rgba(255, 77, 94, 0.1)",
                border: `1px solid ${testResult.success ? "rgba(51, 209, 122, 0.3)" : "rgba(255, 77, 94, 0.3)"}`,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>
                {testResult.success ? (
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ SSH Handshake Succeeded!</span>
                ) : (
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>✗ Connection Failed: {testResult.error}</span>
                )}
              </span>
              {testResult.latencyMs !== undefined && (
                <span className="mono" style={{ color: "var(--text-lo)", fontSize: 11 }}>
                  {testResult.latencyMs}ms roundtrip
                </span>
              )}
            </div>
          )}

          {/* Security Banner */}
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.06)",
              fontSize: 11,
              color: "var(--text-lo)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--amber)", fontSize: 14 }}>🔒</span>
            <span>
              All secrets are encrypted at rest via AES-256-GCM. Unencrypted keys are never returned over HTTP.
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <button
              type="button"
              disabled={testing || !host.trim() || !username.trim() || !canManageVault}
              onClick={handleTestConnection}
              title={
                canManageVault
                  ? "Test SSH connection with configured parameters"
                  : "Testing SSH connections requires System Admin permissions (ssh:manage_vault)"
              }
              style={{
                padding: "9px 16px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                borderRadius: 8,
                color: "var(--text-hi)",
                fontSize: 12,
                fontWeight: 600,
                opacity: testing || !canManageVault ? 0.45 : 1,
                cursor: canManageVault ? "pointer" : "not-allowed",
              }}
            >
              {testing ? "Testing Handshake..." : "⚡ Test Connection"}
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  color: "var(--text-lo)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canManageVault}
                title={
                  canManageVault
                    ? "Encrypt and persist credentials to database vault"
                    : "Saving SSH vault credentials requires System Admin permissions (ssh:manage_vault)"
                }
                style={{
                  padding: "9px 20px",
                  background: "linear-gradient(135deg, #4FD9D0 0%, #22c55e 100%)",
                  border: "none",
                  borderRadius: 8,
                  color: "#06090F",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: canManageVault ? "pointer" : "not-allowed",
                  opacity: canManageVault ? 1 : 0.45,
                }}
              >
                {loading ? "Encrypting & Saving..." : "Save to Vault"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
