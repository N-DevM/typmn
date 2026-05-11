"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../auth.module.css";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!token) { setError("Reset token is missing"); return; }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
        <p style={{ color: "var(--accent-rose)", fontWeight: 600, marginBottom: "0.5rem" }}>Invalid Reset Link</p>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.9375rem" }}>
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <a href="/forgot-password" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
          Request New Link
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
        <p style={{ color: "var(--accent-emerald)", fontWeight: 600, marginBottom: "0.5rem" }}>Password Reset Successfully!</p>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.9375rem", marginBottom: "1.5rem" }}>
          Your password has been updated. You can now log in with your new password.
        </p>
        <a href="/login" className="btn btn-primary btn-lg">Log In →</a>
      </div>
    );
  }

  return (
    <>
      {error && <div className={styles.authError}>{error}</div>}
      <form onSubmit={handleSubmit} className={styles.authForm}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>New Password</label>
          <input className={styles.inputField} type="password" placeholder="Min 8 characters"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Confirm New Password</label>
          <input className={styles.inputField} type="password" placeholder="Confirm password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <button type="submit" className={`btn btn-primary btn-lg ${styles.authBtn}`} disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.authPage}>
      <div className={styles.authGlow} />
      <div className={styles.authCard}>
        <a href="/" className={styles.authLogo}><span>⌨</span> TypmN</a>
        <h1 className={styles.authTitle}>Set New Password</h1>
        <p className={styles.authSubtitle}>Choose a strong password for your account</p>
        <Suspense fallback={<div style={{ textAlign: "center", padding: "2rem" }}>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
        <p className={styles.authSwitch}>
          Remember your password? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
