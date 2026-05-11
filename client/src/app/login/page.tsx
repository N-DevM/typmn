"use client";
import { useState } from "react";
import styles from "../auth.module.css";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(form.emailOrUsername, form.password);
      setAuth(data.accessToken, data.user);
      if (data.user.role === "ADMIN") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
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
        <h1 className={styles.authTitle}>Welcome Back</h1>
        <p className={styles.authSubtitle}>Log in to continue your typing journey</p>

        {error && <div className={styles.authError}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Email or Username</label>
            <input
              className={styles.inputField}
              type="text"
              placeholder="Enter email or username"
              value={form.emailOrUsername}
              onChange={(e) => setForm({ ...form, emailOrUsername: e.target.value })}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Password</label>
            <input
              className={styles.inputField}
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className={styles.authExtra}>
            <a href="/forgot-password" className={styles.forgotLink}>Forgot password?</a>
          </div>
          <button type="submit" className={`btn btn-primary btn-lg ${styles.authBtn}`} disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className={styles.authSwitch}>
          Don&apos;t have an account? <a href="/register">Sign up free</a>
        </p>
      </div>
    </div>
  );
}
