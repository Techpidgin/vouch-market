import {
  ArrowUpRight,
  BadgeCheck,
  CircleUserRound,
  MessageCircleMore,
  Mic2,
  Repeat2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

function Mark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark grid grid-cols-2 gap-[2px] ${large ? "size-36 sm:size-48" : "size-9"}`} aria-hidden>
      {[0, 1, 2, 3].map(i => <i key={i} className={`block ${large ? "bg-[#ecf4e9]" : "bg-current"} ${i === 1 ? "translate-x-1" : ""}`} />)}
    </span>
  );
}

function Wordmark() {
  return (
    <div className="flex min-w-0 flex-col leading-none">
      <span className="font-display text-[1.65rem] tracking-[-.08em] sm:text-[1.9rem]">HANKA</span>
      <span className="hidden hanka-micro pt-1 text-[8px] sm:block">Social proof market</span>
    </div>
  );
}

const proofTypes = [
  { instrument: "vouch", icon: BadgeCheck, title: "Ethos voucher", note: "Credibility, priced by source strength." },
  { instrument: "slash", icon: CircleUserRound, title: "Ethos slash", note: "A distinct social-proof signal." },
  { instrument: "follow", icon: UsersRound, title: "X follow", note: "Audience access from a named account." },
  { instrument: "repost", icon: Repeat2, title: "Repost", note: "Distribution that travels through a source." },
  { instrument: "comment", icon: MessageCircleMore, title: "Comment", note: "Contextual engagement with a brief." },
  { instrument: "space_listener", icon: Mic2, title: "X Spaces", note: "Listen, speak, or contribute—time has value." },
] as const;

function TypingTerms() {
  const message = "Buy a signal. Sell a contribution. Set the terms together.";
  const [value, setValue] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(message);
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setValue(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, []);

  return <p className="terms-typing" aria-label={message}>{value}<span aria-hidden className="terms-caret" /></p>;
}

export default function Home() {
  return (
    <main className="hanka-home hanka-app relative min-h-screen overflow-hidden">
      <div className="hanka-aurora pointer-events-none absolute inset-0" />
      <header className="hanka-header relative">
        <div className="market-shell flex h-16 items-center justify-between gap-3 sm:h-20">
          <Link href="/" className="flex items-center gap-3"><Mark /><Wordmark /></Link>
          <Link href="/market#market" className="hanka-header-action">Open market <ArrowUpRight className="size-3" /></Link>
        </div>
      </header>

      <section className="market-shell relative grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-18">
        <div className="home-copy">
          <p className="hanka-kicker"><Sparkles className="size-3" />HANKA · Social proof exchange</p>
          <h1 className="mt-5 max-w-4xl font-display text-[clamp(4.1rem,11vw,8.6rem)] leading-[.78] tracking-[-.09em]">Trade what moves attention.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--hanka-muted)] sm:text-lg">A premium market for earned signals: Ethos vouchers and slashes today, then follows, reposts, comments, and X Space participation. Buyer and seller set the terms—HANKA verifies the flow.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/market#market" className="hanka-primary-button">Buy or sell proof <ArrowUpRight className="size-4" /></Link>
            <span className="hanka-micro">Wallet-first · USDC on Solana</span>
          </div>
        </div>
        <aside className="terms-stage">
          <div className="terms-logo-bg"><Mark large /></div>
          <div className="terms-glow" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-3"><p className="hanka-kicker">Simple terms</p><span className="status-orb" aria-label="Market ready" /></div>
            <div>
              <TypingTerms />
              <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 text-sm leading-6 text-[#d4ded2]">
                <p><strong className="text-white">Buy.</strong> Request a specific social proof outcome for a named target.</p>
                <p><strong className="text-white">Sell.</strong> Offer a verified contribution from a named source.</p>
                <p><strong className="text-white">Price together.</strong> Scope, source strength, and time determine the quote.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="market-shell relative pb-12 sm:pb-16">
        <div className="flex items-end justify-between gap-6 border-t border-[var(--hanka-line)] pt-5">
          <div><p className="hanka-kicker">Proof catalogue</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em] sm:text-5xl">Designed for more signal.</h2></div>
          <Link href="/market#market" className="hidden hanka-text-link sm:inline-flex">View live market <ArrowUpRight className="size-3" /></Link>
        </div>
        <div className="mt-5 grid gap-px overflow-hidden border border-[var(--hanka-line)] bg-[var(--hanka-line)] sm:grid-cols-2 lg:grid-cols-3">
          {proofTypes.map(({ instrument, icon: Icon, title, note }, index) => (
            <Link key={instrument} href={`/market?proof=${instrument}#market`} className="proof-card group" aria-label={`Browse ${title} markets`}>
              <span className="proof-index">0{index + 1}</span>
              <Icon className="proof-icon" strokeWidth={1.5} />
              <h3 className="mt-7 font-display text-3xl tracking-[-.055em]">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--hanka-muted)]">{note}</p>
              <span className="proof-browse">Browse market</span>
              <ArrowUpRight className="proof-arrow size-4" />
            </Link>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-[var(--hanka-line)]">
        <div className="market-shell flex flex-wrap items-center justify-between gap-4 py-5 text-xs text-[var(--hanka-muted)]">
          <span>HANKA Social Proof Market · USDC on Solana</span>
          <nav className="flex items-center gap-4"><Link href="/market#terms" className="hanka-text-link">Terms</Link><Link href="/ops" className="hanka-text-link">Operations</Link></nav>
        </div>
      </footer>
    </main>
  );
}
