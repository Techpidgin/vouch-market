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

import { Link } from "wouter";

const ETHOS_LOGO_URL = "/ethos%20logo.jpeg";

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

function EthosMark({ className = "" }: { className?: string }) {
  return <img src={ETHOS_LOGO_URL} alt="" aria-hidden className={`ethos-mark ${className}`} />;
}

const proofTypes = [
  { instrument: "vouch", icon: BadgeCheck, ethos: true, title: "Ethos vouch", note: "Credibility, priced by source strength." },
  { instrument: "slash", icon: CircleUserRound, ethos: true, title: "Ethos slash", note: "A distinct social-proof signal." },
  { instrument: "follow", icon: UsersRound, ethos: false, title: "X follow", note: "Audience access from a named account." },
  { instrument: "repost", icon: Repeat2, ethos: false, title: "Repost", note: "Distribution that travels through a source." },
  { instrument: "comment", icon: MessageCircleMore, ethos: false, title: "Comment", note: "Contextual engagement with a brief." },
  { instrument: "space_listener", icon: Mic2, ethos: false, title: "X Spaces", note: "Listen, speak, or contribute—time has value." },
] as const;

const terminalLines = [
  "watch / social-proof",
  "match   Ethos vouch      ready",
  "quote   USDC / unit      live",
  "proof   source -> target signed",
  "route   buy | sell       open",
] as const;

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

      <section className="market-shell relative grid gap-6 py-8 sm:py-10 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-10">
        <div className="home-copy">
          <p className="hanka-kicker"><Sparkles className="size-3" />HANKA · Social proof exchange</p>
          <h1 className="hero-shine-text mt-4 max-w-4xl font-display text-[clamp(3.4rem,6vw,5rem)] leading-[.78] tracking-[-.09em]">Trade what moves attention.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--hanka-muted)] sm:text-lg">Looking for a little more signal? Start with an <span className="ethos-inline"><EthosMark />Ethos vouch</span> or <span className="ethos-inline"><EthosMark />Ethos slash</span>, then explore follows, reposts, comments, and X Spaces. You choose the target and the price—HANKA keeps the exchange simple.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/market#market" className="hanka-primary-button">Buy or sell proof <ArrowUpRight className="size-4" /></Link>
          </div>
        </div>
        <aside className="transaction-terminal" aria-label="HANKA transaction terminal preview">
          <div className="terminal-underlay" aria-hidden="true">
            <div className="terminal-underlay-tabs"><span className="terminal-tab terminal-tab-active">Transactions</span><span className="terminal-tab">Signals</span><span className="terminal-tab">Archive</span></div>
            <div className="terminal-underlay-grid">{[0, 1, 2, 3, 4].map(index => <span key={index} />)}</div>
          </div>
          <div className="terminal-window">
            <img className="terminal-opera-mark" src="/manus-storage/opera-small_1fa074ba.png" alt="" aria-hidden="true" />
            <div className="terminal-window-head"><span>hanka://market</span><span className="terminal-live"><i />LIVE</span></div>
            <div className="terminal-command"><span className="terminal-prompt">›</span> watch --market</div>
            <div className="terminal-code">{terminalLines.map((line, index) => <div className="terminal-code-row" key={line}><span className="terminal-code-index">0{index + 1}</span><code>{line}</code><span className="terminal-code-dot" /></div>)}</div>
            <div className="terminal-window-foot"><span>tx stream</span><span>preview mode</span></div>
          </div>
        </aside>
      </section>

      <section className="market-shell relative pb-12 sm:pb-16">
        <div className="flex items-end justify-between gap-6 border-t border-[var(--hanka-line)] pt-5">
          <div><p className="hanka-kicker">Proof catalogue</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em] sm:text-5xl">Designed for more signal.</h2></div>
          <Link href="/market#market" className="hidden hanka-text-link sm:inline-flex">View live market <ArrowUpRight className="size-3" /></Link>
        </div>
        <div className="mt-5 grid gap-px overflow-hidden border border-[var(--hanka-line)] bg-[var(--hanka-line)] sm:grid-cols-2 lg:grid-cols-3">
          {proofTypes.map(({ instrument, icon: Icon, ethos, title, note }, index) => (
            <Link key={instrument} href={`/market?proof=${instrument}#market`} className="proof-card group" aria-label={`Browse ${title} markets`}>
              <span className="proof-index">0{index + 1}</span>
              {ethos ? <EthosMark className="proof-icon" /> : <Icon className="proof-icon" strokeWidth={1.5} />}
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
          <nav className="flex items-center gap-4"><Link href="/market?support=1#support" className="hanka-text-link">Support</Link><Link href="/market#terms" className="hanka-text-link">Terms</Link><Link href="/ops" className="hanka-text-link">Operations</Link></nav>
        </div>
      </footer>
    </main>
  );
}
