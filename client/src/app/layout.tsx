import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TypmN — Train Faster. Compete Smarter. Win Bigger.",
  description: "The ultimate competitive typing platform. Practice typing, join paid tournaments, compete in real-time, win prizes, and climb global leaderboards.",
  keywords: ["typing", "typing test", "typing practice", "typing tournament", "competitive typing", "WPM", "typing speed"],
  openGraph: {
    title: "TypmN — Competitive Typing Platform",
    description: "Practice typing, compete in tournaments, win real prizes. The premium typing arena.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body>{children}</body>
    </html>
  );
}
