"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { API_BASE } from "@/lib/api";
import { io } from "socket.io-client";

/* ============================================================
   HERO SECTION
   ============================================================ */
function TypingDemo() {
  const text = "Train Faster. Compete Smarter. Win Bigger.";
  const [displayed, setDisplayed] = useState("");
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!deleting && idx < text.length) {
        setDisplayed(text.slice(0, idx + 1));
        setIdx(idx + 1);
      } else if (!deleting && idx === text.length) {
        setTimeout(() => setDeleting(true), 2000);
      } else if (deleting && idx > 0) {
        setDisplayed(text.slice(0, idx - 1));
        setIdx(idx - 1);
      } else {
        setDeleting(false);
      }
    }, deleting ? 30 : 80);
    return () => clearTimeout(timer);
  }, [idx, deleting, text]);

  return (
    <div className={styles.typingDemo}>
      <span className={styles.typingText}>{displayed}</span>
      <span className={styles.cursor}>|</span>
    </div>
  );
}

function LiveStats() {
  const [stats, setStats] = useState({ users: 0, races: 0, wpm: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch real stats from backend
    fetch(`${API_BASE}/api/practice/global-stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setStats({ users: d.users || 0, races: d.races || 0, wpm: d.wpm || 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className={styles.liveStats}>
      <div className={styles.statItem}><span className={styles.statNum}>{stats.users.toLocaleString()}</span><span className={styles.statLabel}>Active Typists</span></div>
      <div className={styles.statDivider} />
      <div className={styles.statItem}><span className={styles.statNum}>{stats.races.toLocaleString()}</span><span className={styles.statLabel}>Races Today</span></div>
      <div className={styles.statDivider} />
      <div className={styles.statItem}><span className={styles.statNum}>{stats.wpm}</span><span className={styles.statLabel}>Avg WPM</span></div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.heroGlow} />
      <div className={styles.heroGrid} />
      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          <span>Live Tournaments Now Open</span>
        </div>
        <h1 className={styles.heroTitle}>
          The Arena for<br />
          <span className={styles.heroGradient}>Competitive Typing</span>
        </h1>
        <p className={styles.heroDesc}>
          Practice daily. Compete in real-time tournaments. Win real prizes.
          Join thousands of typists pushing their limits every day.
        </p>
        <div className={styles.heroCTA}>
          <a href="/register" className={`btn btn-primary btn-lg ${styles.heroBtn}`}>
            Start Typing Free →
          </a>
          <a href="#tournaments" className={`btn btn-secondary btn-lg ${styles.heroBtnSec}`}>
            View Tournaments
          </a>
        </div>
        <TypingDemo />
        <LiveStats />
      </div>
      {/* Floating keyboard keys */}
      <div className={styles.floatingKeys}>
        {["W","P","M","⌨","⚡","🏆","🔥","💯"].map((k, i) => (
          <span key={i} className={styles.floatingKey} style={{ animationDelay: `${i * 0.4}s`, left: `${10 + i * 11}%`, top: `${20 + (i % 3) * 25}%` }}>{k}</span>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   WHY JOIN SECTION
   ============================================================ */
const benefits = [
  { icon: "⚡", title: "Boost Your Speed", desc: "Structured practice modes with real-time analytics to rapidly increase your WPM." },
  { icon: "🏆", title: "Win Real Prizes", desc: "Join paid tournaments with cash prizes. Compete against the best and earn rewards." },
  { icon: "🌍", title: "Rank Globally", desc: "Climb daily, weekly, and all-time leaderboards. Prove you're the fastest typist." },
  { icon: "🎮", title: "Compete Live", desc: "Real-time multiplayer typing races. See opponents' progress as you type." },
  { icon: "🔥", title: "Stay Motivated", desc: "XP, streaks, badges, levels, and daily challenges keep you coming back." },
];

function WhyJoinSection() {
  return (
    <section className={styles.section} id="why-join">
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Why TypmN?</span>
          <h2 className={styles.sectionTitle}>Everything You Need to<br /><span className="text-gradient">Dominate the Keyboard</span></h2>
          <p className={styles.sectionDesc}>From casual practice to competitive tournaments — one platform for all your typing goals.</p>
        </div>
        <div className={styles.benefitsGrid}>
          {benefits.map((b, i) => (
            <div key={i} className={styles.benefitCard} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={styles.benefitIcon}>{b.icon}</div>
              <h3 className={styles.benefitTitle}>{b.title}</h3>
              <p className={styles.benefitDesc}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   TOURNAMENTS SECTION — REAL DATA FROM BACKEND
   ============================================================ */
function CountdownTimer({ targetDate, status }: { targetDate: Date, status: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    // Initial check
    if (targetDate.getTime() - Date.now() <= 0) {
      setIsPassed(true);
      return;
    }

    const iv = setInterval(() => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setIsPassed(true);
        clearInterval(iv);
        return;
      }
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [targetDate]);

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
      {[{ v: time.d, l: "D" }, { v: time.h, l: "H" }, { v: time.m, l: "M" }, { v: time.s, l: "S" }].map((t, i) => (
        <div key={i} className={styles.countdownUnit}>
          <span className={styles.countdownNum}>{String(t.v).padStart(2, "0")}</span>
          <span className={styles.countdownLabel}>{t.l}</span>
        </div>
      ))}
    </div>
  );
}

// Removed fallback data

function TournamentsSection() {
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    const fetchTournaments = () => {
      fetch(`${API_BASE}/api/tournaments?status=IN_PROGRESS,REGISTRATION_OPEN&limit=6`)
        .then(r => r.json())
        .then(d => {
          setTournaments(d.tournaments || []);
        })
        .catch(() => setTournaments([]));
    };

    fetchTournaments();

    let socket: any = null;
    try {
      socket = io(API_BASE, { withCredentials: true });
      socket.on('tournament:updated', () => {
        fetchTournaments();
      });
    } catch (e) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleRegister = (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/register"; return; }
    window.location.href = "/dashboard/tournaments";
  };

  return (
    <section className={`${styles.section} ${styles.tournamentSection}`} id="tournaments">
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>💰 Live Tournaments</span>
          <h2 className={styles.sectionTitle}>Compete for<br /><span className="text-gradient">Real Prizes</span></h2>
          <p className={styles.sectionDesc}>Join paid typing tournaments. Prove your skill. Win cash rewards.</p>
        </div>
        <div className={styles.tournamentGrid}>
          {tournaments.length > 0 ? (
            tournaments.map((t, i) => (
              <div key={t.id || i} className={styles.tournamentCard}>
                <div className={styles.tournamentBadge}>
                  {t.type === "TOP_RANKING" ? "Top 10 Ranking" : "Elimination Bracket"}
                </div>
                <h3 className={styles.tournamentName}>{t.name}</h3>
                <CountdownTimer targetDate={new Date(t.scheduledAt)} status={t.status} />
                <div className={styles.tournamentDetails}>
                  <div className={styles.tournamentDetail}><span className={styles.detailLabel}>Prize Pool</span><span className={styles.detailValue}>{t.currency} {t.prizePool?.toLocaleString()}</span></div>
                  <div className={styles.tournamentDetail}><span className={styles.detailLabel}>Entry Fee</span><span className={styles.detailValue}>{t.entryFee > 0 ? `${t.currency} ${t.entryFee}` : "Free"}</span></div>
                  <div className={styles.tournamentDetail}><span className={styles.detailLabel}>Seats</span><span className={styles.detailValue}>{t._count?.participants || 0}/{t.maxParticipants}</span></div>
                </div>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => handleRegister(t.id)}>Register Now</button>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", gridColumn: "1 / -1", padding: "2rem" }}>
              No active tournaments at the moment. Please check back later.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PRACTICE DEMO SECTION
   ============================================================ */
function PracticeDemo() {
  const sampleText = "The quick brown fox jumps over the lazy dog near the river";
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleType = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!startTime) setStartTime(Date.now());
    setInput(val);
    if (startTime) {
      const elapsed = (Date.now() - startTime) / 60000;
      const words = val.trim().split(/\s+/).length;
      if (elapsed > 0) setWpm(Math.round(words / elapsed));
    }
  };

  const accuracy = input.length === 0 ? 100 : Math.round(
    (input.split("").filter((c, i) => c === sampleText[i]).length / input.length) * 100
  );

  return (
    <section className={styles.section} id="practice">
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>⌨️ Try It Now</span>
          <h2 className={styles.sectionTitle}>Start Typing<br /><span className="text-gradient-cyan">Right Now</span></h2>
          <p className={styles.sectionDesc}>No signup needed. Feel the typing experience instantly.</p>
        </div>
        <div className={styles.practiceCard} onClick={() => inputRef.current?.focus()}>
          <div className={styles.practiceMetrics}>
            <div className={styles.metric}><span className={styles.metricValue}>{wpm}</span><span className={styles.metricLabel}>WPM</span></div>
            <div className={styles.metric}><span className={styles.metricValue}>{accuracy}%</span><span className={styles.metricLabel}>Accuracy</span></div>
            <div className={styles.metric}><span className={styles.metricValue}>{input.length}</span><span className={styles.metricLabel}>Chars</span></div>
          </div>
          <div className={styles.practiceText}>
            {sampleText.split("").map((char, i) => {
              let cls = styles.charUpcoming;
              if (i < input.length) cls = input[i] === char ? styles.charCorrect : styles.charIncorrect;
              else if (i === input.length) cls = styles.charCurrent;
              return <span key={i} className={cls}>{char}</span>;
            })}
          </div>
          <input
            ref={inputRef}
            className={styles.practiceInput}
            value={input}
            onChange={handleType}
            placeholder="Click here and start typing..."
            spellCheck={false}
            autoComplete="off"
          />
          {input.length > 0 && (
            <button className={styles.resetBtn} onClick={(e) => { e.stopPropagation(); setInput(""); setStartTime(null); setWpm(0); }}>
              Reset ↺
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   LEADERBOARD SECTION — REAL DATA
   ============================================================ */
// Removed fallback data

function LeaderboardSection() {
  const [tab, setTab] = useState("weekly");
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/practice/leaderboard?period=${tab}&limit=5`)
      .then(r => r.json())
      .then(d => setData(d.leaderboard || []))
      .catch(() => setData([]));
  }, [tab]);

  return (
    <section className={styles.section} id="leaderboard">
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>🏅 Leaderboard</span>
          <h2 className={styles.sectionTitle}>Top <span className="text-gradient">Typists</span></h2>
          <p className={styles.sectionDesc}>The fastest fingers in the world. Can you beat them?</p>
        </div>
        <div className={styles.leaderboardTabs}>
          {["daily", "weekly", "all-time"].map(t => (
            <button key={t} className={`${styles.leaderboardTab} ${tab === t ? styles.tabActive : ""}`} onClick={() => setTab(t === "all-time" ? "alltime" : t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.leaderboardTable}>
          {data.length > 0 ? (
            data.map((p) => (
              <div key={p.rank} className={`${styles.leaderboardRow} ${p.rank <= 3 ? styles.topThree : ""}`}>
                <div className={styles.rankBadge} data-rank={p.rank}>
                  {p.rank <= 3 ? ["🥇","🥈","🥉"][p.rank-1] : `#${p.rank}`}
                </div>
                <div className={styles.playerInfo}>
                  <div className={styles.playerAvatar}>{p.country || "🌍"}</div>
                  <div>
                    <div className={styles.playerName}>{p.username || p.name}</div>
                    <div className={styles.playerLevel}>Level {p.level}</div>
                  </div>
                </div>
                <div className={styles.playerStats}>
                  <div className={styles.playerWpm}>{p.bestWpm || p.wpm} <span>WPM</span></div>
                  <div className={styles.playerAcc}>{p.avgWpm ? `${p.avgWpm} avg` : `${p.accuracy}%`}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "2rem" }}>
              The leaderboard is currently empty. Start practicing to claim the top spot!
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: "var(--space-xl)" }}>
          <a href="/leaderboard" className="btn btn-secondary">View Full Leaderboard →</a>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FAQ SECTION
   ============================================================ */
const faqs = [
  { q: "What is TypmN?", a: "TypmN is a premium competitive typing platform where you can practice daily, join paid tournaments, compete in real-time, and win cash prizes." },
  { q: "How do tournaments work?", a: "We offer two types: Elimination Bracket (head-to-head rounds until a winner is crowned) and Top 10 Ranking (all compete, top 3 win prizes, positions 4-10 get refunded)." },
  { q: "How do I pay for tournaments?", a: "We support JazzCash, EasyPaisa, and bank transfers. Pay using your preferred method and upload the receipt. Our team verifies payments within minutes." },
  { q: "Is it free to practice?", a: "Yes! All practice modes are completely free. Only tournament entry requires a fee." },
  { q: "How are winners paid?", a: "Prize money is distributed via JazzCash, EasyPaisa, or bank transfer within 24 hours of tournament completion." },
  { q: "Is there anti-cheat protection?", a: "Yes. We use server-side validation, tab-switch detection, copy-paste prevention, and suspicious WPM flagging to ensure fair competition." },
];

function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenIdx(prev => prev === idx ? null : idx);
  };

  return (
    <section className={styles.section} id="faq">
      <div className="container">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>❓ FAQ</span>
          <h2 className={styles.sectionTitle}>Frequently Asked<br /><span className="text-gradient">Questions</span></h2>
        </div>
        <div className={styles.faqList}>
          {faqs.map((f, i) => (
            <div key={i} className={`${styles.faqItem} ${openIdx === i ? styles.faqOpen : ""}`}>
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => toggleFaq(i)}
                aria-expanded={openIdx === i}
              >
                <span>{f.q}</span>
                <span className={styles.faqIcon}>{openIdx === i ? "−" : "+"}</span>
              </button>
              {openIdx === i && (
                <div className={styles.faqAnswer}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   HEADER & FOOTER
   ============================================================ */
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={`container ${styles.headerInner}`}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoIcon}>⌨</span>
            <span className={styles.logoText}>TypmN</span>
          </a>
          <nav className={styles.nav}>
            <a href="/practice" className={styles.navLink}>Practice</a>
            <a href="/race" className={styles.navLink}>Race</a>
            <a href="#tournaments" className={styles.navLink}>Tournaments</a>
            <a href="/leaderboard" className={styles.navLink}>Leaderboard</a>
            <a href="#faq" className={styles.navLink}>FAQ</a>
          </nav>
          <div className={styles.headerActions}>
            <div className={styles.desktopOnly}>
              <a href="/login" className="btn btn-ghost">Log In</a>
              <a href="/register" className="btn btn-primary">Sign Up Free</a>
            </div>
            <button className={styles.mobileToggle} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </header>
      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}>
        <a href="#practice" onClick={() => setMenuOpen(false)}>Practice</a>
        <a href="#tournaments" onClick={() => setMenuOpen(false)}>Tournaments</a>
        <a href="#leaderboard" onClick={() => setMenuOpen(false)}>Leaderboard</a>
        <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        <a href="/login" onClick={() => setMenuOpen(false)}>Log In</a>
        <a href="/register" onClick={() => setMenuOpen(false)}>Sign Up Free</a>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}><span className={styles.logoIcon}>⌨</span><span className={styles.logoText}>TypmN</span></div>
            <p className={styles.footerDesc}>Train Faster. Compete Smarter. Win Bigger.<br />The ultimate competitive typing platform.</p>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Platform</h4>
            <a href="#practice">Practice</a>
            <a href="#tournaments">Tournaments</a>
            <a href="#leaderboard">Leaderboard</a>
            <a href="/register">Sign Up</a>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Support</h4>
            <a href="#faq">FAQ</a>
            <a href="#">Contact Us</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerTitle}>Community</h4>
            <a href="#">Discord</a>
            <a href="#">Twitter</a>
            <a href="#">Instagram</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© 2025 TypmN. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <WhyJoinSection />
        <TournamentsSection />
        <PracticeDemo />
        <LeaderboardSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
