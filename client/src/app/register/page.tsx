"use client";
import { useState } from "react";
import styles from "../auth.module.css";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", username: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords don't match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const data = await api.register(form.email, form.username, form.password);
      setAuth(data.accessToken, data.user);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authGlow} />
      <div className={styles.authCard}>
        <a href="/" className={styles.authLogo}>
          <span>⌨</span> TypmN
        </a>
        <h1 className={styles.authTitle}>Create Account</h1>
        <p className={styles.authSubtitle}>Join the arena. Start competing today.</p>

        {error && <div className={styles.authError}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Email</label>
            <input className={styles.inputField} type="email" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Username</label>
            <input className={styles.inputField} type="text" placeholder="Choose a username"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} maxLength={20} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Password</label>
            <input className={styles.inputField} type="password" placeholder="Min 8 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Confirm Password</label>
            <input className={styles.inputField} type="password" placeholder="Confirm password"
              value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
          </div>
          <button type="submit" className={`btn btn-primary btn-lg ${styles.authBtn}`} disabled={loading}>
            {loading ? "Creating Account..." : "Create Account →"}
          </button>
        </form>

        <p className={styles.authSwitch}>
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
