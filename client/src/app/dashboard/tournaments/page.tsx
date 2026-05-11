"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import styles from "./tournaments.module.css";
import { api, API_BASE } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

interface Tournament {
  id: string; name: string; description?: string; type: string; status: string;
  entryFee: number; prizePool: number; currency: string;
  maxParticipants: number; scheduledAt: string;
  _count: { participants: number };
  userParticipantStatus?: string;
  participantId?: string | null;
  rejectionReason?: string | null;
}

function CountdownTimer({ date, status }: { date: string, status: string }) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    // Initial check
    if (new Date(date).getTime() - Date.now() <= 0) {
      setIsPassed(true);
      return;
    }

    const iv = setInterval(() => {
      const diff = new Date(date).getTime() - Date.now();
      if (diff <= 0) {
        setIsPassed(true);
        clearInterval(iv);
        return;
      }
      setT({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    }, 1000);
    return () => clearInterval(iv);
  }, [date]);

  if (isPassed || status === 'COMPLETED') {
    if (status === 'IN_PROGRESS') {
      return (
        <div className={styles.liveBadgeContainer}>
          <div className={styles.liveIndicator}></div>
          <span>Live Now!</span>
        </div>
      );
    } else if (status === 'COMPLETED') {
      return null;
    } else {
      return (
        <div className={styles.startingSoonBadge}>
          ⏳ Starting Soon...
        </div>
      );
    }
  }

  return (
    <div className={styles.countdown}>
      {[{ v: t.d, l: "D" }, { v: t.h, l: "H" }, { v: t.m, l: "M" }, { v: t.s, l: "S" }].map((x, i) => (
        <div key={i} className={styles.cdUnit}><span className={styles.cdNum}>{String(x.v).padStart(2, "0")}</span><span className={styles.cdLabel}>{x.l}</span></div>
      ))}
    </div>
  );
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");
  const [registering, setRegistering] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  
  // Payment Modal State
  const [paymentModalData, setPaymentModalData] = useState<{ tournamentId: string; participantId: string; entryFee: number; currency: string } | null>(null);
  const [payForm, setPayForm] = useState({ method: "JAZZCASH", transactionId: "", senderName: "", senderAccount: "" });
  const [payFile, setPayFile] = useState<File | null>(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const initialLoadDone = useRef(false);

  const fetchTournaments = useCallback(() => {
    const statusMap: Record<string, string> = { upcoming: "REGISTRATION_OPEN", live: "IN_PROGRESS", past: "COMPLETED" };
    api.getTournaments(statusMap[tab] || "")
      .then(d => { setTournaments(d.tournaments || []); })
      .catch(() => { setTournaments([]); })
      .finally(() => { 
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          setLoading(false); 
        }
      });
  }, [tab]);

  // When tab changes after initial load, briefly show loading then fetch
  useEffect(() => {
    if (initialLoadDone.current) {
      setLoading(true);
      const statusMap: Record<string, string> = { upcoming: "REGISTRATION_OPEN", live: "IN_PROGRESS", past: "COMPLETED" };
      api.getTournaments(statusMap[tab] || "")
        .then(d => { setTournaments(d.tournaments || []); })
        .catch(() => { setTournaments([]); })
        .finally(() => { setLoading(false); });
    }
  }, [tab]);

  useEffect(() => {
    // Check on mount if we should default to Live tab
    const token = getToken();
    if (token && tab === "upcoming") {
      api.getTournaments("IN_PROGRESS")
        .then(d => {
          const liveTourneys = d.tournaments || [];
          if (liveTourneys.some((t: any) => t.userParticipantStatus === "REGISTERED")) {
            setTab("live");
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
    
    // Refresh silently in background (no loading spinner)
    const interval = setInterval(() => {
      const statusMap: Record<string, string> = { upcoming: "REGISTRATION_OPEN", live: "IN_PROGRESS", past: "COMPLETED" };
      api.getTournaments(statusMap[tab] || "")
        .then(d => { setTournaments(d.tournaments || []); })
        .catch(() => {});
    }, 15000);
    
    let socket: any = null;
    try {
      socket = io(API_BASE, { 
        withCredentials: true, 
        timeout: 5000, 
        reconnectionAttempts: 2,
        transports: ['websocket', 'polling']
      });
      
      socket.on('tournament:updated', () => {
        const statusMap: Record<string, string> = { upcoming: "REGISTRATION_OPEN", live: "IN_PROGRESS", past: "COMPLETED" };
        api.getTournaments(statusMap[tab] || "")
          .then(d => { setTournaments(d.tournaments || []); })
          .catch(() => {});
      });
      
      const user = getUser();
      if (user) {
        socket.on(`payment:status_changed:${user.id}`, (data: any) => {
          if (data.status === "VERIFIED" || data.status === "REJECTED") {
            fetchTournaments();
            if (data.status === "VERIFIED") setMsg("Your payment was successfully verified! You are now registered.");
            if (data.status === "REJECTED") setMsg("Your payment was rejected. Please submit a valid proof.");
            setTimeout(() => setMsg(""), 5000);
            setReviewModalOpen(false);
          }
        });
      }
    } catch (e) {}

    // Safety: force loading off after 3 seconds no matter what
    const safetyTimer = setTimeout(() => setLoading(false), 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimer);
      if (socket) socket.disconnect();
    };
  }, [tab, fetchTournaments]);

  const handleRegister = async (id: string) => {
    const token = getToken();
    if (!token) { window.location.href = "/login"; return; }
    setRegistering(id);
    try {
      const data = await api.registerForTournament(id);
      
      if (data.requiresPayment && data.participant) {
        setPaymentModalData({
          tournamentId: id,
          participantId: data.participant.id,
          entryFee: tournaments.find(t => t.id === id)?.entryFee || 0,
          currency: tournaments.find(t => t.id === id)?.currency || "PKR",
        });
        setMsg("Registered! Please complete your payment to participate.");
      } else {
        setMsg("Successfully registered for the tournament!");
      }
      fetchTournaments();
      setTimeout(() => setMsg(""), 5000);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setRegistering(null);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalData || !payFile) { setMsg("Please select a screenshot."); return; }
    setSubmittingPay(true);
    try {
      const formData = new FormData();
      formData.append("participantId", paymentModalData.participantId);
      formData.append("amount", paymentModalData.entryFee.toString());
      formData.append("method", payForm.method);
      formData.append("transactionId", payForm.transactionId);
      formData.append("senderName", payForm.senderName);
      formData.append("senderAccount", payForm.senderAccount);
      formData.append("screenshot", payFile);

      await api.submitPayment(formData);
      setMsg("Payment submitted successfully! Waiting for admin approval.");
      setPaymentModalData(null);
      fetchTournaments();
      setTimeout(() => setMsg(""), 5000);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setSubmittingPay(false);
    }
  };

  return (
    <div className={styles.page}>
      <Sidebar activePage="tournaments" />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>🏆 Tournaments</h1>
          <p className={styles.subtitle}>Compete for real prizes. Prove your typing speed.</p>
        </div>

        {msg && <div className={styles.alert}>{msg}</div>}

        <div className={styles.tabs}>
          {["upcoming", "live", "past"].map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`} onClick={() => setTab(t)}>
              {t === "upcoming" ? "📋 Upcoming" : t === "live" ? "🔴 Live" : "📜 Past"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : tournaments.length === 0 ? (
          <div className={styles.empty}>
            <p>No {tab} tournaments yet.</p>
            <p className={styles.emptyHint}>Check back soon — new tournaments are announced regularly!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {tournaments.map(t => (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.typeBadge}>{t.type === "ELIMINATION_BRACKET" ? "⚔️ Elimination" : "🏅 Top Ranking"}</span>
                  <span className={`${styles.statusBadge} ${styles[`status_${t.status}`]}`}>{t.status.replace(/_/g, " ")}</span>
                </div>
                <h3 className={styles.cardTitle}>{t.name}</h3>
                {t.description && <p className={styles.cardDesc}>{t.description}</p>}
                <CountdownTimer date={t.scheduledAt} status={t.status} />
                <div className={styles.details}>
                  <div className={styles.detail}><span>Prize Pool</span><span className={styles.prize}>{t.currency} {t.prizePool.toLocaleString()}</span></div>
                  <div className={styles.detail}><span>Entry Fee</span><span>{t.entryFee > 0 ? `${t.currency} ${t.entryFee}` : "Free"}</span></div>
                  <div className={styles.detail}><span>Participants</span><span>{t._count.participants}/{t.maxParticipants}</span></div>
                </div>
                {t.status === "REGISTRATION_OPEN" && (
                  <>
                    {t.userParticipantStatus === "REGISTERED" && (
                      <div className={styles.verifiedBtn}>Registered - Coming Soon</div>
                    )}
                    {t.userParticipantStatus === "PAYMENT_UNDER_REVIEW" && (
                      <button className={styles.reviewBtn} onClick={() => setReviewModalOpen(true)}>
                        ⏳ Payment Under Review
                      </button>
                    )}
                    {t.userParticipantStatus === "PENDING_PAYMENT" && (
                      <button className={styles.pendingBtn} onClick={() => setPaymentModalData({ tournamentId: t.id, participantId: t.participantId!, entryFee: t.entryFee, currency: t.currency })}>
                        💳 Submit Payment Proof
                      </button>
                    )}
                    {t.userParticipantStatus === "PAYMENT_REJECTED" && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(244, 63, 94, 0.1)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ color: 'var(--accent-rose)', fontSize: '0.8125rem', fontWeight: 600 }}>
                          ❌ Payment Rejected: {t.rejectionReason || 'Invalid proof, please resubmit'}
                        </div>
                        <button className={styles.pendingBtn} onClick={() => setPaymentModalData({ tournamentId: t.id, participantId: t.participantId!, entryFee: t.entryFee, currency: t.currency })}>
                          💳 Resubmit Payment Proof
                        </button>
                      </div>
                    )}
                    {(!t.userParticipantStatus || t.userParticipantStatus === "NOT_REGISTERED") && (
                      <button className={`btn btn-primary ${styles.joinBtn}`} onClick={() => handleRegister(t.id)} disabled={registering === t.id}>
                        {registering === t.id ? "Registering..." : (t.entryFee > 0 ? "Pay & Join →" : "Join Tournament →")}
                      </button>
                    )}
                  </>
                )}
                {t.status === "IN_PROGRESS" && t.userParticipantStatus === "REGISTERED" && (
                  <button className={`btn btn-primary ${styles.joinBtn}`} onClick={() => window.location.href = `/dashboard/tournaments/live/${t.id}`}>
                    Play Now 🚀
                  </button>
                )}
                {(t.status === "COMPLETED" || (t.status === "IN_PROGRESS" && t.userParticipantStatus !== "REGISTERED")) && (
                  <button className={`btn btn-secondary ${styles.joinBtn}`} onClick={() => window.location.href = `/dashboard/tournaments/live/${t.id}`}>
                    View Leaderboard
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

        {/* Payment Modal */}
        {paymentModalData && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <button className={styles.modalClose} onClick={() => setPaymentModalData(null)}>✕</button>
              <h2 className={styles.modalTitle}>Complete Registration</h2>
              <p className={styles.modalDesc}>Please transfer the entry fee to one of the accounts below and upload the screenshot of the successful transaction.</p>
              
              <div className={styles.paymentInfo}>
                <div className={styles.paymentInfoRow}><span>Entry Fee:</span><span>{paymentModalData.currency} {paymentModalData.entryFee}</span></div>
              </div>
              
              <div className={styles.paymentAccounts}>
                <div className={styles.paymentAccTitle}>Official Payment Accounts</div>
                <div className={styles.paymentAccItem}><strong>JazzCash:</strong> 0300-1234567 (TypmN Official)</div>
                <div className={styles.paymentAccItem}><strong>Easypaisa:</strong> 0345-7654321 (TypmN Admin)</div>
                <div className={styles.paymentAccItem}><strong>Bank Transfer:</strong> HBL 1234-5678-9012 (TypmN Ltd)</div>
              </div>

              <form onSubmit={handlePaymentSubmit}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Payment Method</label>
                  <select className={styles.formSelect} value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="EASYPAISA">Easypaisa</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sender Name (Account Title)</label>
                  <input className={styles.formInput} required value={payForm.senderName} onChange={e => setPayForm({...payForm, senderName: e.target.value})} placeholder="e.g. Ali Ahmed" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sender Account Number</label>
                  <input className={styles.formInput} required value={payForm.senderAccount} onChange={e => setPayForm({...payForm, senderAccount: e.target.value})} placeholder="e.g. 03001234567" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Transaction ID / TID</label>
                  <input className={styles.formInput} required value={payForm.transactionId} onChange={e => setPayForm({...payForm, transactionId: e.target.value})} placeholder="Enter 11-digit TID" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Payment Screenshot</label>
                  <input type="file" accept="image/*" className={styles.fileInput} required onChange={e => setPayFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                
                <button type="submit" className={`btn btn-primary ${styles.submitPayBtn}`} disabled={submittingPay}>
                  {submittingPay ? "Submitting..." : "Submit Payment Proof"}
                </button>
                <div className={styles.formNote}>Admin will verify your payment within 24 hours to confirm your spot.</div>
              </form>
            </div>
          </div>
        )}

        {/* Wait Modal */}
        {reviewModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ textAlign: 'center' }}>
              <button className={styles.modalClose} onClick={() => setReviewModalOpen(false)}>✕</button>
              <div className={styles.waitIllustration}>⏳</div>
              <h2 className={styles.modalTitle}>Verification in Progress</h2>
              <p className={styles.modalDesc} style={{ marginBottom: 0 }}>
                You have successfully submitted your payment proof! Our admin team is currently reviewing your transaction.
                <br /><br />
                This process usually takes 2-4 hours. You will be fully registered once verified.
              </p>
            </div>
          </div>
        )}

    </div>
  );
}
