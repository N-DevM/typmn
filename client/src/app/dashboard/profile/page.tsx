"use client";
import { useState, useEffect } from "react";
import styles from "./profile.module.css";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ country: "", bio: "" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    api.getMe().then(d => {
      setUser(d.user);
      setForm({ country: d.user.country || "", bio: d.user.bio || "" });
    }).catch(() => { window.location.href = "/login"; });
  }, []);

  if (!user) return <div className={styles.loading}><div className={styles.spinner} /></div>;

  const s = user.stats;
  const tier = (s?.level || 1) >= 50 ? "Legend" : (s?.level || 1) >= 40 ? "Diamond" : (s?.level || 1) >= 30 ? "Platinum" : (s?.level || 1) >= 20 ? "Gold" : (s?.level || 1) >= 10 ? "Silver" : "Bronze";

  return (
    <div className={styles.page}>
      <Sidebar activePage="profile" />
      <main className={styles.main}>
        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarLarge}>{user.username[0].toUpperCase()}</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.username}>{user.username}</h1>
            <div className={styles.meta}>
              <span className={styles.tierBadge}>{tier}</span>
              <span>Level {s?.level || 1}</span>
              <span>⚡ {(s?.totalXp || 0).toLocaleString()} XP</span>
              {user.country && <span>📍 {user.country}</span>}
            </div>
            {user.bio && <p className={styles.bio}>{user.bio}</p>}
            <p className={styles.joined}>Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Stats */}
        <h2 className={styles.sectionTitle}>Performance Stats</h2>
        <div className={styles.statsGrid}>
          {[
            { icon: "⚡", val: s?.bestWpm?.toFixed(0) || 0, lbl: "Best WPM" },
            { icon: "📊", val: s?.avgWpm?.toFixed(0) || 0, lbl: "Avg WPM" },
            { icon: "🎯", val: `${s?.avgAccuracy?.toFixed(1) || 0}%`, lbl: "Accuracy" },
            { icon: "🏁", val: s?.totalPractices || 0, lbl: "Practices" },
            { icon: "🔥", val: user.streaks?.currentStreak || 0, lbl: "Current Streak" },
            { icon: "⭐", val: user.streaks?.longestStreak || 0, lbl: "Longest Streak" },
            { icon: "🏆", val: s?.tournamentsWon || 0, lbl: "Tournaments Won" },
            { icon: "🎮", val: s?.tournamentsPlayed || 0, lbl: "Tournaments Played" },
            { icon: "⏱️", val: `${Math.floor((s?.totalTypingTime || 0) / 60)}m`, lbl: "Total Time" },
          ].map((st, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statIcon}>{st.icon}</div>
              <div className={styles.statVal}>{st.val}</div>
              <div className={styles.statLbl}>{st.lbl}</div>
            </div>
          ))}
        </div>

        {/* Account Info */}
        <h2 className={styles.sectionTitle}>Account Details</h2>
        <div className={styles.detailsCard}>
          <div className={styles.detailRow}><span>Email</span><span>{user.email}</span></div>
          <div className={styles.detailRow}><span>Username</span><span>{user.username}</span></div>
          <div className={styles.detailRow}><span>Role</span><span className={styles.roleBadge}>{user.role}</span></div>
          <div className={styles.detailRow}><span>Status</span><span className={styles.statusActive}>Active</span></div>
        </div>
      </main>
    </div>
  );
}
