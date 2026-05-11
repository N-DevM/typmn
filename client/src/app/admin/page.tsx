"use client";
import { useState, useEffect, useCallback } from "react";
import styles from "./admin.module.css";
import { api, API_BASE } from "@/lib/api";
import { getToken, handleLogout } from "@/lib/auth";

interface DashboardStats {
  totalUsers: number; activeUsers: number; recentSignups: number;
  totalTournaments: number; activeTournaments: number;
  pendingPayments: number; totalRevenue: number;
  totalPractices: number; antiCheatFlags: number;
}

interface Payment {
  id: string; amount: number; method: string; status: string; transactionId?: string;
  senderName?: string; screenshotUrl?: string; createdAt: string;
  user: { id: string; username: string; email: string };
  participant?: { tournament: { id: string; name: string } };
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [tab, setTab] = useState("overview");
  const [paymentTab, setPaymentTab] = useState("queue");
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const token = getToken();

  useEffect(() => {
    if (!token) { window.location.href = "/login"; return; }
    api.getAdminDashboard()
      .then(d => { setStats(d); setLoading(false); })
      .catch((err) => { 
        // Redirect on ANY error (unauthorized, forbidden, expired, etc)
        handleLogout();
        window.location.href = '/login';
      });
  }, [token]);

  useEffect(() => {
    if (tab === "payments" && token) {
      if (paymentTab === "queue") {
        api.getPaymentQueue().then(d => setPayments(d.payments || [])).catch(() => {});
      } else {
        api.getPaymentHistory().then(d => setPaymentHistory(d.payments || [])).catch(() => {});
      }
    }
  }, [tab, paymentTab]);

  const verifyPayment = async (id: string, action: string) => {
    if (action === "REJECTED") {
      setRejectId(id);
      setRejectReason("");
      setRejectModalOpen(true);
      return;
    }
    await api.verifyPayment(id, { action });
    setPayments(prev => prev.filter(p => p.id !== id));
    setPaymentHistory(prev => prev.map(p => p.id === id ? { ...p, status: action } : p));
  };

  const confirmRejection = async () => {
    if (!rejectId) return;
    await api.verifyPayment(rejectId, { action: "REJECTED", adminNotes: rejectReason, rejectionReason: rejectReason });
    setPayments(prev => prev.filter(p => p.id !== rejectId));
    setPaymentHistory(prev => prev.map(p => p.id === rejectId ? { ...p, status: "REJECTED" } : p));
    setRejectModalOpen(false);
    setRejectId(null);
    setRejectReason("");
  };

  const filteredHistory = paymentHistory.filter(p => 
    p.user.username.toLowerCase().includes(historySearch.toLowerCase()) ||
    p.user.email.toLowerCase().includes(historySearch.toLowerCase()) ||
    (p.transactionId && p.transactionId.toLowerCase().includes(historySearch.toLowerCase()))
  );

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /><p>Loading admin panel...</p></div>;

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <a href="/" className={styles.logo}><span>⌨</span> TypmN</a>
        <div className={styles.adminLabel}>ADMIN PANEL</div>
        <nav className={styles.nav}>
          {[
            { id: "overview", icon: "📊", label: "Overview" },
            { id: "payments", icon: "💳", label: "Payments" },
            { id: "tournaments", icon: "🏆", label: "Tournaments" },
            { id: "users", icon: "👥", label: "Users" },
            { id: "anticheat", icon: "🛡️", label: "Anti-Cheat" },
          ].map(item => (
            <button key={item.id} className={`${styles.navItem} ${tab === item.id ? styles.navActive : ""}`} onClick={() => setTab(item.id)}>
              <span>{item.icon}</span> {item.label}
              {item.id === "payments" && stats && stats.pendingPayments > 0 && (
                <span className={styles.badge}>{stats.pendingPayments}</span>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <a href="/dashboard" className={styles.backBtn}>← Back to Dashboard</a>
          <button onClick={handleLogout} className={styles.logoutBtn}>🚪 Log Out</button>
        </div>
      </aside>

      <main className={styles.main}>
        {/* OVERVIEW TAB */}
        {tab === "overview" && stats && (
          <>
            <h1 className={styles.pageTitle}>Admin Overview</h1>
            <div className={styles.statsGrid}>
              {[
                { icon: "👥", val: stats.totalUsers, label: "Total Users", color: "indigo" },
                { icon: "✅", val: stats.activeUsers, label: "Active Users", color: "emerald" },
                { icon: "🆕", val: stats.recentSignups, label: "New This Week", color: "cyan" },
                { icon: "🏆", val: stats.totalTournaments, label: "Tournaments", color: "amber" },
                { icon: "🔴", val: stats.activeTournaments, label: "Active Now", color: "rose" },
                { icon: "💳", val: stats.pendingPayments, label: "Pending Payments", color: "amber" },
                { icon: "💰", val: `PKR ${stats.totalRevenue.toLocaleString()}`, label: "Total Revenue", color: "emerald" },
                { icon: "⌨️", val: stats.totalPractices, label: "Total Practices", color: "indigo" },
                { icon: "🛡️", val: stats.antiCheatFlags, label: "Unreviewed Flags", color: "rose" },
              ].map((s, i) => (
                <div key={i} className={styles.statCard} data-color={s.color}>
                  <div className={styles.statIcon}>{s.icon}</div>
                  <div className={styles.statVal}>{s.val}</div>
                  <div className={styles.statLbl}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>💳 Payment Verification</h1>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className={`btn ${paymentTab === 'queue' ? 'btn-primary' : ''}`} 
                  onClick={() => setPaymentTab('queue')}
                  style={{ opacity: paymentTab === 'queue' ? 1 : 0.6 }}
                >Pending Queue</button>
                <button 
                  className={`btn ${paymentTab === 'history' ? 'btn-primary' : ''}`} 
                  onClick={() => setPaymentTab('history')}
                  style={{ opacity: paymentTab === 'history' ? 1 : 0.6 }}
                >History</button>
              </div>
            </div>

            {paymentTab === 'queue' ? (
              payments.length === 0 ? (
                <div className={styles.empty}>No pending payments to review.</div>
              ) : (
                <div className={styles.paymentsList}>
                  {payments.map(p => (
                    <div key={p.id} className={styles.paymentCard}>
                      <div className={styles.paymentHeader}>
                        <div>
                          <span className={styles.paymentUser}>{p.user.username}</span>
                          <span className={styles.paymentEmail}>{p.user.email}</span>
                        </div>
                        <span className={styles.paymentAmount}>PKR {p.amount}</span>
                      </div>
                      <div className={styles.paymentDetails}>
                        <div><strong>Method:</strong> {p.method}</div>
                        <div><strong>Transaction ID:</strong> {p.transactionId || "N/A"}</div>
                        <div><strong>Sender:</strong> {p.senderName || "N/A"}</div>
                        <div><strong>Tournament:</strong> {p.participant?.tournament?.name || "N/A"}</div>
                        <div><strong>Date:</strong> {new Date(p.createdAt).toLocaleString()}</div>
                      </div>
                      {p.screenshotUrl && (
                        <div className={styles.screenshotWrap}>
                          <button className={`btn`} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} onClick={() => setViewReceiptUrl(`${API_BASE}${p.screenshotUrl}`)}>
                            🖼️ View Receipt
                          </button>
                        </div>
                      )}
                      <div className={styles.paymentActions}>
                        <button className={`btn btn-primary ${styles.approveBtn}`} onClick={() => verifyPayment(p.id, "VERIFIED")}>Approve</button>
                        <button className={styles.rejectBtn} onClick={() => verifyPayment(p.id, "REJECTED")}>❌ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    placeholder="Search by username, email, or TID..." 
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    style={{ maxWidth: '100%' }}
                  />
                </div>
                {filteredHistory.length === 0 ? (
                  <div className={styles.empty}>No payment history matches your search 📝</div>
                ) : (
                  <div className={styles.paymentsList}>
                    {filteredHistory.map(p => (
                      <div key={p.id} className={styles.paymentCard} style={{ opacity: p.status === 'REJECTED' ? 0.7 : 1 }}>
                      <div className={styles.paymentHeader}>
                        <div>
                          <span className={styles.paymentUser}>{p.user.username}</span>
                          <span className={styles.paymentEmail}>{p.user.email}</span>
                        </div>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: p.status === 'VERIFIED' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                        }}>
                          {p.status}
                        </span>
                      </div>
                      <div className={styles.paymentDetails}>
                        <div><strong>Amount:</strong> PKR {p.amount}</div>
                        <div><strong>Method:</strong> {p.method}</div>
                        <div><strong>TID:</strong> {p.transactionId || "N/A"}</div>
                        <div><strong>Tournament:</strong> {p.participant?.tournament?.name || "N/A"}</div>
                        <div><strong>Date:</strong> {new Date(p.createdAt).toLocaleString()}</div>
                      </div>
                      {p.screenshotUrl && (
                        <div className={styles.screenshotWrap}>
                          <button className={`btn`} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} onClick={() => setViewReceiptUrl(`${API_BASE}${p.screenshotUrl}`)}>
                            🖼️ View Receipt
                          </button>
                        </div>
                      )}
                      {p.status === 'VERIFIED' && (
                        <div className={styles.paymentActions} style={{ marginTop: '1rem' }}>
                          <button className={styles.rejectBtn} onClick={() => verifyPayment(p.id, "REJECTED")}>❌ Revert & Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </>
            )}

            {/* Receipt Modal */}
            {viewReceiptUrl && (
              <div className={styles.modalOverlay} onClick={() => setViewReceiptUrl(null)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <button className={styles.modalClose} onClick={() => setViewReceiptUrl(null)}>✕</button>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Payment Receipt</h3>
                  <img src={viewReceiptUrl} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }} />
                </div>
              </div>
            )}

            {/* Rejection Modal */}
            {rejectModalOpen && (
              <div className={styles.modalOverlay} onClick={() => setRejectModalOpen(false)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()}>
                  <h3 className={styles.formTitle}>Reject Payment</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
                    Please provide a reason for rejecting this payment. The user will see this message and be asked to resubmit.
                  </p>
                  <textarea 
                    className={styles.input} 
                    style={{ width: '100%', minHeight: '100px', resize: 'vertical', marginBottom: '1rem' }}
                    placeholder="e.g., Transaction ID does not match, Screenshot is blurry, etc."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={() => setRejectModalOpen(false)}>Cancel</button>
                    <button 
                      className={`btn btn-primary`} 
                      style={{ background: 'var(--accent-rose)' }} 
                      onClick={confirmRejection}
                      disabled={!rejectReason.trim()}
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TOURNAMENTS TAB */}
        {tab === "tournaments" && <TournamentManager />}

        {/* USERS TAB */}
        {tab === "users" && <UserManager />}

        {tab === "anticheat" && <AntiCheatManager />}
      </main>
    </div>
  );
}

function TournamentManager() {
  const [form, setForm] = useState({ name: "", type: "ELIMINATION_BRACKET", entryFee: "200", prizePool: "5000", maxParticipants: "64", scheduledAt: "", endScheduledAt: "", difficulty: "medium" });
  const [msg, setMsg] = useState("");
  const [tournaments, setTournaments] = useState<any[]>([]);

  const fetchTournaments = useCallback(() => {
    api.getTournaments("", 100)
      .then(d => {
        const sorted = (d.tournaments || []).sort((a: any, b: any) => {
          const isActiveA = ['IN_PROGRESS', 'REGISTRATION_OPEN'].includes(a.status);
          const isActiveB = ['IN_PROGRESS', 'REGISTRATION_OPEN'].includes(b.status);
          if (isActiveA && !isActiveB) return -1;
          if (!isActiveA && isActiveB) return 1;
          return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
        });
        setTournaments(sorted);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.request(`/api/tournaments/${id}`, { method: "PATCH", body: { status } });
      fetchTournaments();
    } catch {}
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.request('/api/tournaments', {
        method: "POST",
        body: { ...form, entryFee: parseFloat(form.entryFee), prizePool: parseFloat(form.prizePool), maxParticipants: parseInt(form.maxParticipants) },
      });
      setMsg("Tournament created!");
      setForm({ name: "", type: "ELIMINATION_BRACKET", entryFee: "200", prizePool: "5000", maxParticipants: "64", scheduledAt: "", endScheduledAt: "", difficulty: "medium" });
      fetchTournaments();
    } catch (err: any) { setMsg(err.message); }
  };

  return (
    <>
      <h1 className={styles.pageTitle}>🏆 Tournament Management</h1>
      {msg && <div className={styles.alert}>{msg}</div>}
      <div className={styles.formCard}>
        <h3 className={styles.formTitle}>Create New Tournament</h3>
        <form onSubmit={create} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.inputGroup}><label>Tournament Name</label><input className={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className={styles.inputGroup}><label>Type</label>
              <select className={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="ELIMINATION_BRACKET">Elimination Bracket</option>
                <option value="TOP_RANKING">Top 10 Ranking</option>
              </select>
            </div>
            <div className={styles.inputGroup}><label>Difficulty (Paragraph)</label>
              <select className={styles.input} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                <option value="easy">Easy (Simple words)</option>
                <option value="medium">Medium (Standard paragraph)</option>
                <option value="hard">Hard (Punctuation &amp; Numbers)</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.inputGroup}><label>Entry Fee (PKR)</label><input className={styles.input} type="number" value={form.entryFee} onChange={e => setForm({ ...form, entryFee: e.target.value })} /></div>
            <div className={styles.inputGroup}><label>Prize Pool (PKR)</label><input className={styles.input} type="number" value={form.prizePool} onChange={e => setForm({ ...form, prizePool: e.target.value })} /></div>
            <div className={styles.inputGroup}><label>Max Participants</label><input className={styles.input} type="number" value={form.maxParticipants} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} /></div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.inputGroup}><label>Start Date/Time</label><input className={styles.input} type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} required /></div>
            <div className={styles.inputGroup}><label>End Date/Time</label><input className={styles.input} type="datetime-local" value={form.endScheduledAt} onChange={e => setForm({ ...form, endScheduledAt: e.target.value })} required /></div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Tournament</button>
        </form>
      </div>

      <div className={styles.formCard} style={{ marginTop: '2rem' }}>
        <h3 className={styles.formTitle}>Manage Existing Tournaments</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tournaments.map(t => (
            <div key={t.id} style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem', padding: '0.15rem 0.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)' }}>{t.status.replace(/_/g, ' ')}</span></div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Registered: {t._count?.participants || 0} / {t.maxParticipants}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {t.status === 'REGISTRATION_OPEN' && (<button className="btn btn-primary" onClick={() => updateStatus(t.id, 'IN_PROGRESS')}>Start Live</button>)}
                {t.status === 'IN_PROGRESS' && (<button className="btn" style={{ background: 'var(--accent-emerald)', color: 'white', borderColor: 'transparent' }} onClick={() => updateStatus(t.id, 'COMPLETED')}>End</button>)}
                {(t.status === 'DRAFT' || t.status === 'REGISTRATION_OPEN') && (<button className="btn" style={{ background: 'var(--accent-rose)', color: 'white', borderColor: 'transparent' }} onClick={() => updateStatus(t.id, 'CANCELLED')}>Cancel</button>)}
              </div>
            </div>
          ))}
          {tournaments.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>No tournaments found.</div>}
        </div>
      </div>
    </>
  );
}

function UserManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.getAdminUsers(search).then(d => setUsers(d.users || [])).catch(() => {});
  }, [search]);

  const updateUser = async (id: string, data: any) => {
    await api.updateAdminUser(id, data);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
  };

  return (
    <>
      <h1 className={styles.pageTitle}>👥 User Management</h1>
      <input className={styles.searchInput} placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className={styles.userTable}>
        <div className={styles.tableHeader}>
          <span>Username</span><span>Email</span><span>Level</span><span>Best WPM</span><span>Status</span><span>Actions</span>
        </div>
        {users.map(u => (
          <div key={u.id} className={styles.tableRow}>
            <span className={styles.username}>{u.username}</span>
            <span className={styles.email}>{u.email}</span>
            <span>{u.stats?.level || 1}</span>
            <span>{u.stats?.bestWpm?.toFixed(0) || 0}</span>
            <span className={`${styles.statusBadge} ${styles[`st_${u.status}`]}`}>{u.status}</span>
            <div className={styles.actions}>
              {u.status === "ACTIVE" ? (
                <button className={styles.banBtn} onClick={() => updateUser(u.id, { status: "BANNED" })}>Ban</button>
              ) : (
                <button className={styles.unbanBtn} onClick={() => updateUser(u.id, { status: "ACTIVE" })}>Unban</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AntiCheatManager() {
  const [flags, setFlags] = useState<any[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const fetchFlags = useCallback(() => {
    setLoading(true);
    api.getAntiCheatFlags(showReviewed)
      .then(d => { setFlags(d.flags || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [showReviewed]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleReview = async (id: string, action: string, banUser = false) => {
    try {
      const result = await api.reviewAntiCheatFlag(id, { action, banUser });
      setActionMsg(result.message);
      setFlags(prev => prev.filter(f => f.id !== id));
      setTimeout(() => setActionMsg(""), 4000);
    } catch (err: any) {
      setActionMsg(err.message || "Failed to review flag");
    }
  };

  const severityColor: Record<string, string> = { HIGH: 'var(--accent-rose)', MEDIUM: 'var(--accent-amber)', LOW: 'var(--text-tertiary)' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>🛡️ Anti-Cheat Flags</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${!showReviewed ? 'btn-primary' : ''}`} onClick={() => setShowReviewed(false)} style={{ opacity: !showReviewed ? 1 : 0.6 }}>Unreviewed</button>
          <button className={`btn ${showReviewed ? 'btn-primary' : ''}`} onClick={() => setShowReviewed(true)} style={{ opacity: showReviewed ? 1 : 0.6 }}>Reviewed</button>
        </div>
      </div>

      {actionMsg && <div className={styles.alert}>{actionMsg}</div>}

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : flags.length === 0 ? (
        <div className={styles.empty}>
          {showReviewed ? 'No reviewed flags yet.' : '✅ No unreviewed flags — all clear!'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {flags.map(f => {
            const details = f.details as any || {};
            return (
              <div key={f.id} style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderLeft: `4px solid ${severityColor[f.severity] || 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '0.75rem' }}>{f.user?.username || 'Unknown'}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>{f.user?.email}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: `${severityColor[f.severity]}20`, color: severityColor[f.severity], fontWeight: 700 }}>{f.severity}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(f.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {f.type?.split(' | ').map((flag: string, i: number) => (
                    <div key={i} style={{ padding: '0.25rem 0', borderBottom: i < f.type.split(' | ').length - 1 ? '1px solid var(--border)' : 'none' }}>⚠️ {flag}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                  <span>⚡ {details.wpm?.toFixed?.(0) || details.wpm || '?'} WPM</span>
                  <span>🎯 {details.accuracy?.toFixed?.(1) || details.accuracy || '?'}%</span>
                  <span>⏱ {details.duration || '?'}s</span>
                  {details.tabSwitches > 0 && <span>🔄 {details.tabSwitches} tab switches</span>}
                  {details.pasteAttempts > 0 && <span>📋 {details.pasteAttempts} paste attempts</span>}
                  {details.keystrokeIntervals && <span>⌨️ avg:{details.keystrokeIntervals.avg}ms stdDev:{details.keystrokeIntervals.stdDev}ms</span>}
                </div>
                {!showReviewed && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.8125rem' }} onClick={() => handleReview(f.id, 'dismiss')}>Dismiss</button>
                    <button className="btn" style={{ background: 'var(--accent-amber)', color: 'white', borderColor: 'transparent', fontSize: '0.8125rem' }} onClick={() => handleReview(f.id, 'confirm', false)}>Confirm Flag</button>
                    <button className="btn" style={{ background: 'var(--accent-rose)', color: 'white', borderColor: 'transparent', fontSize: '0.8125rem' }} onClick={() => handleReview(f.id, 'confirm', true)}>🚫 Ban User</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
