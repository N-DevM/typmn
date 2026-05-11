"use client";
import { useEffect, useState } from "react";
import { getUser, handleLogout, isAdmin } from "@/lib/auth";

interface SidebarProps {
  activePage: 'dashboard' | 'practice' | 'tournaments' | 'leaderboard' | 'profile' | 'admin';
}

export default function Sidebar({ activePage }: SidebarProps) {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    setShowAdmin(isAdmin());
  }, []);

  const navItems = [
    { id: 'dashboard', href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'practice', href: '/dashboard/practice', icon: '⌨️', label: 'Practice' },
    { id: 'tournaments', href: '/dashboard/tournaments', icon: '🏆', label: 'Tournaments' },
    { id: 'leaderboard', href: '/dashboard/leaderboard', icon: '🏅', label: 'Leaderboard' },
    { id: 'profile', href: '/dashboard/profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <aside style={styles.sidebar}>
      <a href="/" style={styles.logo}>
        <span>⌨</span> TypmN
      </a>
      <nav style={styles.nav}>
        {navItems.map(item => (
          <a
            key={item.id}
            href={item.href}
            style={{
              ...styles.navItem,
              ...(activePage === item.id ? styles.navActive : {}),
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span> {item.label}
          </a>
        ))}
        {showAdmin && (
          <a
            href="/admin"
            style={{
              ...styles.navItem,
              ...(activePage === 'admin' ? styles.navActive : {}),
            }}
          >
            <span style={styles.navIcon}>⚙️</span> Admin Panel
          </a>
        )}
      </nav>
      <div style={styles.sidebarFooter}>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          🚪 Log Out
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '260px',
    minHeight: '100vh',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1rem',
    position: 'sticky',
    top: 0,
    alignSelf: 'flex-start',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    textDecoration: 'none',
    marginBottom: '2rem',
    letterSpacing: '-0.02em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    width: '100%',
    textAlign: 'left' as const,
  },
  navActive: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  navIcon: {
    fontSize: '1.125rem',
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-tertiary)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
  },
};
