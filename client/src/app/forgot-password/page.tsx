"use client";
import { useState } from "react";
import styles from "../auth.module.css";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.forgotPassword(email);
      setSent(true);
      // In dev mode, backend returns the reset URL directly
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authGlow} />
      <div className={styles.authCard}>
        <a href="/" className={styles.authLogo}><span>⌨</span> TypmN</a>
        <h1 className={styles.authTitle}>Reset Password</h1>
        <p className={styles.authSubtitle}>Enter your email to receive a reset link</p>

        {error && <div className={styles.authError}>{error}</div>}

        {sent ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📧</div>
            <p style={{ color: "var(--accent-emerald)", fontWeight: 600, marginBottom: "0.5rem" }}>Check your email!</p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.9375rem" }}>
              If an account exists with {email}, we&apos;ve sent password reset instructions.
            </p>
            {resetUrl && (
              <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)", wordBreak: "break-all" }}>
                <p style={{ color: "var(--accent-amber)", fontSize: "0.8125rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                  🔧 Dev Mode — Reset Link:
                </p>
                <a href={resetUrl} style={{ color: "var(--accent-indigo)", fontSize: "0.875rem" }}>
                  {resetUrl}
                </a>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email Address</label>
              <input className={styles.inputField} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className={`btn btn-primary btn-lg ${styles.authBtn}`} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className={styles.authSwitch}>
          Remember your password? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
