import { Button } from "@/components/ui/button";
import { ArcWalletConnect } from "@/components/ArcWalletConnect";
import { BountyCreateDialog } from "@/components/BountyCreateDialog";
import { BountySubmissionDialog } from "@/components/BountySubmissionDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ARC_TESTNET_TOKENS,
  acceptArcTask,
  approveArcEscrow,
  approveArcTask,
  arcExplorerTx,
  createArcPointExchange,
  createArcTask,
  declineArcPointExchange,
  disputeArcPointExchange,
  disputeArcTask,
  getArcEscrowAddress,
  getArcOpenBounties,
  getArcWalletDashboard,
  getArcPointExchangeToken,
  getArcTokenDecimals,
  submitArcTask,
  toTokenUnits,
  type ArcTaskRecord,
  type ArcTokenSymbol,
} from "@/lib/arcTestnet";
import { ARC_MARK_URL, OPERA_UNDERLAY_URL } from "@/lib/brandAssets";
import { buildArcSocialBountyTerms, type ArcSocialInstrument } from "@shared/arcBountyTerms";
import { ArrowUpRight, CheckCircle2, ChevronDown, Clock3, ExternalLink, Filter, Loader2, LockKeyhole, RefreshCw, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { formatUnits, type Address } from "viem";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type Mode = "bounties" | "points";
type BountyView = "open" | "mine";
type BountySort = "reward" | "newest" | "ending";
type SocialMeta = {
  taskId: number;
  requesterWallet: string;
  title: string | null;
  summary: string | null;
  deliverables: string | null;
  projectSlug: string;
  instrument: ArcSocialInstrument;
  targetHandle: string;
  proofDetail: string | null;
  spaceMinutes: number | null;
  retentionDays: number;
  featuredToken: string | null;
  location: string | null;
  verificationMethod: "onchain_delivery_commitment" | "manual_evidence_reference" | null;
  termsHash: string;
  sourceHandle: string | null;
  takerWallet: string | null;
  pointsPerUnit: number | null;
  followerCount: number | null;
  ethosScore: number | null;
  kaitoScore: number | null;
  kaitoAura: number | null;
};

const socialInstruments: { value: ArcSocialInstrument; label: string }[] = [
  { value: "vouch", label: "Ethos vouch" },
  { value: "slash", label: "Ethos slash" },
  { value: "follow", label: "X follow" },
  { value: "repost", label: "X repost" },
  { value: "comment", label: "X comment" },
  { value: "space_listener", label: "X Space listener" },
  { value: "space_speaker", label: "X Space speaker" },
  { value: "space_contributor", label: "X Space contributor" },
  { value: "hanka_points", label: "HANKA Points" },
];

const defaultTime = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString().slice(0, 16);
const unixFromLocalInput = (value: string, label: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error(`${label} must be in the future.`);
  return Math.floor(timestamp / 1_000);
};
const shortAddress = (address?: string) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
const shortHash = (hash: string) => `${hash.slice(0, 9)}…${hash.slice(-6)}`;
const sameAddress = (left?: string, right?: string) => Boolean(left && right && left.toLowerCase() === right.toLowerCase());
const tokenForAddress = (address: string) => ARC_TESTNET_TOKENS.find(item => item.address.toLowerCase() === address.toLowerCase());
const tokenDecimals = async (token: ArcTokenSymbol) => {
  const meta = ARC_TESTNET_TOKENS.find(item => item.symbol === token)!;
  return "decimals" in meta && typeof meta.decimals === "number" ? meta.decimals : getArcTokenDecimals(meta.address);
};
const displayAmount = (amount: bigint, decimals: number) => {
  const [whole, fraction] = formatUnits(amount, decimals).split(".");
  return fraction ? `${whole}.${fraction.slice(0, 4).replace(/0+$/, "") || "0"}` : whole;
};
const countdown = (seconds: bigint) => {
  const remaining = Number(seconds) * 1_000 - Date.now();
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const days = Math.floor(hours / 24);
  return days ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor((remaining % 3_600_000) / 60_000)}m`;
};
const compact = (value?: number | null) => !value ? "0" : value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m` : value >= 1_000 ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : value.toLocaleString();
const socialLabel = (instrument?: ArcSocialInstrument) => socialInstruments.find(item => item.value === instrument)?.label ?? "Social proof";
const retentionOptions = [7, 14, 30, 60, 90] as const;

export default function ArcMarket() {
  const [wallet, setWallet] = useState<Address | "">("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("bounties");
  const [view, setView] = useState<BountyView>("open");
  const [sort, setSort] = useState<BountySort>("reward");
  const [query, setQuery] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState<ArcSocialInstrument | "all">("all");
  const [sourceEditor, setSourceEditor] = useState<ArcTaskRecord | null>(null);
  const [sourceHandle, setSourceHandle] = useState("");
  const [pointsPerUnit, setPointsPerUnit] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [ethosScore, setEthosScore] = useState("");
  const [kaitoScore, setKaitoScore] = useState("");
  const [kaitoAura, setKaitoAura] = useState("");
  const [bountyKind, setBountyKind] = useState<"social" | "general">("social");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bountyToken, setBountyToken] = useState<ArcTokenSymbol>("USDC");
  const [bountyAmount, setBountyAmount] = useState("5");
  const [bountyTitle, setBountyTitle] = useState("");
  const [bountySummary, setBountySummary] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>([""]);
  const [projectSlug, setProjectSlug] = useState("commonsmade");
  const [bountyInstrument, setBountyInstrument] = useState<ArcSocialInstrument>("vouch");
  const [targetHandle, setTargetHandle] = useState("");
  const [proofDetail, setProofDetail] = useState("");
  const [spaceMinutes, setSpaceMinutes] = useState("");
  const [retentionDays, setRetentionDays] = useState<(typeof retentionOptions)[number]>(30);
  const [featuredToken, setFeaturedToken] = useState("");
  const [location, setLocation] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"onchain_delivery_commitment" | "manual_evidence_reference">("onchain_delivery_commitment");
  const [localAttachments, setLocalAttachments] = useState<File[]>([]);
  const [safeAttested, setSafeAttested] = useState(false);
  const [specificAttested, setSpecificAttested] = useState(false);
  const [acceptBy, setAcceptBy] = useState(() => defaultTime(24 * 60));
  const [dueAt, setDueAt] = useState(() => defaultTime(7 * 24 * 60));
  const [pointToken, setPointToken] = useState<ArcTokenSymbol>("USDC");
  const [pointAmount, setPointAmount] = useState("50");
  const [counterparty, setCounterparty] = useState("");
  const [pointTerms, setPointTerms] = useState("Airdrop point exchange agreement: both participants lock equal collateral under the agreed terms.");
  const [pointAcceptBy, setPointAcceptBy] = useState(() => defaultTime(24 * 60));
  const [settleBy, setSettleBy] = useState(() => defaultTime(7 * 24 * 60));
  const [manageId, setManageId] = useState("");
  const [submissionBounty, setSubmissionBounty] = useState<ArcTaskRecord | null>(null);
  const escrowAddress = getArcEscrowAddress();
  const metadataInput = useMemo(() => ({ contractAddress: (escrowAddress ?? "0x0000000000000000000000000000000000000000") as Address }), [escrowAddress]);
  const metadataQuery = trpc.arcBounty.metadata.useQuery(metadataInput, { enabled: Boolean(escrowAddress), retry: false });
  const registerBounty = trpc.arcBounty.register.useMutation();
  const canClaim = trpc.arcBounty.canClaim.useMutation();
  const registerSource = trpc.arcBounty.registerSource.useMutation();
  const [bounties, setBounties] = useState<ArcTaskRecord[]>([]);
  const [bountyLoading, setBountyLoading] = useState(false);

  const loadBounties = async (quiet = false) => {
    if (!escrowAddress) return;
    try {
      setBountyLoading(true);
      setBounties(await getArcOpenBounties());
      await metadataQuery.refetch();
      if (!quiet) toast.success("Open Bounties refreshed from Arc Testnet.");
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Could not load open Bounties.");
    } finally { setBountyLoading(false); }
  };

  useEffect(() => { void loadBounties(true); }, [escrowAddress]);

  const metadataByTask = useMemo(() => new Map((metadataQuery.data as SocialMeta[] | undefined ?? []).map(item => [String(item.taskId), item])), [metadataQuery.data]);
  const visibleBounties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return bounties
      .filter(record => {
        const meta = metadataByTask.get(record.id.toString());
        const matchesView = view === "open" || sameAddress(record.requester, wallet) || sameAddress(record.taker, wallet);
        const searchable = [record.id.toString(), record.requester, record.termsHash, meta?.title, meta?.summary, meta?.deliverables, meta?.targetHandle, meta?.sourceHandle, meta?.instrument, meta?.proofDetail].filter(Boolean).join(" ").toLowerCase();
        return matchesView && (instrumentFilter === "all" || meta?.instrument === instrumentFilter) && (!normalizedQuery || searchable.includes(normalizedQuery));
      })
      .sort((left, right) => sort === "reward" ? Number(right.reward - left.reward) : sort === "ending" ? Number(left.acceptDeadline - right.acceptDeadline) : Number(right.id - left.id));
  }, [bounties, instrumentFilter, metadataByTask, query, sort, view, wallet]);
  const featuredBounty = visibleBounties[0];

  async function onWalletConnected(address: Address) {
    setWallet(address);
    toast.success("Arc Testnet wallet connected.");
  }

  async function approve(token: ArcTokenSymbol, amount: string) {
    try {
      setBusy(true);
      const tokenMeta = ARC_TESTNET_TOKENS.find(item => item.symbol === token)!;
      const hash = await approveArcEscrow(tokenMeta.address, toTokenUnits(amount, await tokenDecimals(token)));
      toast.success("Exact testnet token approval confirmed.");
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Token approval failed."); }
    finally { setBusy(false); }
  }

  async function createBounty(event: FormEvent) {
    event.preventDefault();
    if (!escrowAddress || !wallet) return;
    try {
      setBusy(true);
      const socialTerms = bountyKind === "social" ? {
        title: bountyTitle,
        summary: bountySummary,
        deliverables: deliverables.map(item => item.trim()).filter(Boolean),
        projectSlug,
        instrument: bountyInstrument,
        targetHandle,
        proofDetail,
        spaceMinutes: spaceMinutes ? Number(spaceMinutes) : undefined,
        retentionDays,
        featuredToken: featuredToken || undefined,
        location: location || undefined,
        verificationMethod,
      } : null;
      if (!safeAttested || !specificAttested) throw new Error("Confirm the Bounty safety and specificity statements before funding.");
      if (!bountyTitle.trim() || !bountySummary.trim() || !deliverables.some(item => item.trim())) throw new Error("Add a title, summary, and at least one concrete deliverable.");
      const terms = socialTerms ? buildArcSocialBountyTerms(socialTerms) : ["HANKA Arc Testnet general Bounty", `Title: ${bountyTitle.trim()}`, `Summary: ${bountySummary.trim()}`, `Deliverables: ${deliverables.map(item => item.trim()).filter(Boolean).map((item, index) => `${index + 1}. ${item}`).join(" | ")}`, "Winners: 1 (current Arc Testnet contract limit)", "Safety attestation: no prohibited or exploitative work is requested."].join("\n");
      const tokenMeta = ARC_TESTNET_TOKENS.find(item => item.symbol === bountyToken)!;
      const created = await createArcTask({
        token: tokenMeta.address,
        reward: toTokenUnits(bountyAmount, await tokenDecimals(bountyToken)),
        acceptDeadline: unixFromLocalInput(acceptBy, "Acceptance deadline"),
        dueAt: unixFromLocalInput(dueAt, "Delivery deadline"),
        terms,
      });
      if (socialTerms) {
        try {
          await registerBounty.mutateAsync({ contractAddress: escrowAddress, taskId: Number(created.taskId), requesterWallet: wallet, ...socialTerms });
        } catch (metadataError) {
          toast.error(metadataError instanceof Error ? metadataError.message : "The Bounty is funded, but its readable social details could not be saved.");
        }
      }
      toast.success(`Bounty #${created.taskId.toString()} is funded on Arc Testnet.`);
      setCreateDialogOpen(false);
      window.open(arcExplorerTx(created.hash), "_blank", "noopener,noreferrer");
      await loadBounties(true);
      document.getElementById("bounty-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not fund this Bounty."); }
    finally { setBusy(false); }
  }

  async function acceptBounty(record: ArcTaskRecord) {
    if (!wallet || !escrowAddress) return;
    const meta = metadataByTask.get(record.id.toString());
    if (meta) { setSourceEditor(record); return; }
    try {
      setBusy(true);
      const hash = await acceptArcTask(record.id);
      toast.success(`Bounty #${record.id.toString()} accepted.`);
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
      await loadBounties(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not accept this Bounty."); }
    finally { setBusy(false); }
  }

  async function confirmSocialClaim(event: FormEvent) {
    event.preventDefault();
    if (!sourceEditor || !wallet || !escrowAddress) return;
    try {
      setBusy(true);
      await canClaim.mutateAsync({ contractAddress: escrowAddress, taskId: Number(sourceEditor.id), takerWallet: wallet, sourceHandle });
      const hash = await acceptArcTask(sourceEditor.id);
      await registerSource.mutateAsync({
        contractAddress: escrowAddress,
        taskId: Number(sourceEditor.id),
        takerWallet: wallet,
        sourceHandle,
        pointsPerUnit: Number(pointsPerUnit),
        followerCount: followerCount ? Number(followerCount) : undefined,
        ethosScore: ethosScore ? Number(ethosScore) : undefined,
        kaitoScore: kaitoScore ? Number(kaitoScore) : undefined,
        kaitoAura: kaitoAura ? Number(kaitoAura) : undefined,
      });
      toast.success(`Bounty #${sourceEditor.id.toString()} accepted with your source profile.`);
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
      setSourceEditor(null);
      await loadBounties(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not claim this social-proof Bounty."); }
    finally { setBusy(false); }
  }

  async function createPointExchange(event: FormEvent) {
    event.preventDefault();
    try {
      setBusy(true);
      const tokenMeta = ARC_TESTNET_TOKENS.find(item => item.symbol === pointToken)!;
      const hash = await createArcPointExchange({ token: tokenMeta.address, taker: counterparty as Address, collateral: toTokenUnits(pointAmount, await tokenDecimals(pointToken)), acceptDeadline: unixFromLocalInput(pointAcceptBy, "Acceptance deadline"), settlementDeadline: unixFromLocalInput(settleBy, "Settlement deadline"), terms: pointTerms });
      toast.success("Point exchange funding transaction submitted.");
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not fund the point exchange."); }
    finally { setBusy(false); }
  }

  async function openSubmission() {
    try {
      if (!wallet) throw new Error("Connect the accepted worker wallet before submitting delivery.");
      if (!/^\d+$/.test(manageId)) throw new Error("Enter the accepted Bounty ID you want to submit.");
      setBusy(true);
      const dashboard = await getArcWalletDashboard(wallet);
      const record = dashboard.tasks.find(task => task.id === BigInt(manageId));
      if (!record || !sameAddress(record.taker, wallet) || record.state !== 2) throw new Error("Only the wallet assigned to an accepted Bounty can open its delivery submission.");
      setSubmissionBounty(record);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open this Bounty submission."); }
    finally { setBusy(false); }
  }

  async function submitBountyDelivery(payload: { description: string; links: string[]; attachments: File[]; confirmedDeliverables: string[] }) {
    if (!submissionBounty || !wallet) return;
    try {
      if (!sameAddress(submissionBounty.taker, wallet) || submissionBounty.state !== 2) throw new Error("This wallet is not eligible to submit the selected Bounty.");
      setBusy(true);
      const terms = ["HANKA Arc Testnet Bounty delivery submission", `Bounty ID: ${submissionBounty.id.toString()}`, `Description: ${payload.description}`, `Confirmed deliverables: ${payload.confirmedDeliverables.map((item, index) => `${index + 1}. ${item}`).join(" | ")}`, `Evidence links: ${payload.links.length ? payload.links.join(" | ") : "none"}`, `Local attachment previews: ${payload.attachments.length} (not uploaded)`, "Claimant attests that this delivery is truthful and follows HANKA content restrictions."].join("\n");
      const hash = await submitArcTask(submissionBounty.id, terms);
      toast.success(`Delivery commitment submitted for Bounty #${submissionBounty.id.toString()}.`);
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
      setSubmissionBounty(null);
      await loadBounties(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit the delivery commitment."); }
    finally { setBusy(false); }
  }

  async function manage(action: "approve" | "dispute") {
    try {
      if (!/^\d+$/.test(manageId)) throw new Error("Enter a numeric Bounty ID.");
      setBusy(true);
      const id = BigInt(manageId);
      const hash = action === "approve" ? await approveArcTask(id) : await disputeArcTask(id);
      toast.success("Arc Bounty transaction submitted.");
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
      await loadBounties(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit this Bounty action."); }
    finally { setBusy(false); }
  }

  return <div className="hanka-app min-h-screen text-[var(--hanka-text)]">
    <header className="hanka-header"><div className="market-shell flex h-16 items-center justify-between gap-3 sm:h-20"><Link href="/" className="flex items-center gap-2 font-display text-2xl tracking-[-.07em]"><span className="grid size-7 grid-cols-2 gap-[2px]" aria-hidden>{[0, 1, 2, 3].map(index => <i key={index} className={`block bg-[#f2efe4] ${index === 1 ? "translate-x-1" : ""}`} />)}</span>HANKA</Link><nav className="hidden items-center gap-5 text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--hanka-muted)] sm:flex"><a href="#bounty-board" className="hover:text-[var(--hanka-text)]">BOUNTIES</a><button type="button" onClick={() => setMode("points")} className="hover:text-[var(--hanka-text)]">POINT EXCHANGE</button>{wallet ? <Link href="/arc/dashboard" className="hover:text-[var(--hanka-text)]">MY ACTIVITY</Link> : null}</nav><ArcWalletConnect address={wallet} busy={busy} onConnected={onWalletConnected} /></div></header>
    <main>
      <section className="arc-market-intro relative overflow-hidden border-b border-[var(--hanka-line)]"><img src={OPERA_UNDERLAY_URL} alt="" aria-hidden="true" className="arc-market-intro-underlay" /><div className="market-shell relative flex flex-col justify-between gap-5 py-5 sm:flex-row sm:items-end sm:py-6"><div className="flex items-start gap-3"><span className="arc-mark-tile"><img src={ARC_MARK_URL} alt="Arc" /></span><div><p className="hanka-kicker text-[var(--hanka-accent)]">ARC TESTNET · ESCROW MARKET</p><h1 className="mt-1 font-display text-[clamp(2.2rem,4vw,3.5rem)] leading-[.84] tracking-[-.08em]">Fund proof. Settle onchain.</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--hanka-muted)]">One contract path for social proof, Bounties, and point exchanges. Faucet tokens only.</p></div></div><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => { setMode("bounties"); setCreateDialogOpen(true); }} className="hanka-primary-button">CREATE BOUNTY <ArrowUpRight className="size-4" /></button>{escrowAddress ? <a className="inline-flex min-h-10 items-center gap-2 border border-white/20 bg-[#07110c]/75 px-3 text-[10px] font-semibold uppercase tracking-[.11em] text-white hover:border-white/40" href={`https://testnet.arcscan.app/address/${escrowAddress}`} target="_blank" rel="noreferrer">CONTRACT <ExternalLink className="size-3" /></a> : null}{wallet ? <Link href="/arc/dashboard" className="inline-flex min-h-10 items-center gap-2 border border-white/20 bg-[#07110c]/75 px-3 text-[10px] font-semibold uppercase tracking-[.11em] text-white hover:border-white/40">MY ACTIVITY <ArrowUpRight className="size-3" /></Link> : null}</div></div></section>
      <section id="bounty-board" className="market-shell py-6 sm:py-8"><div className="overflow-hidden border border-[var(--hanka-line)] bg-[#0c100e]"><div className="flex flex-col gap-4 border-b border-[var(--hanka-line)] px-4 py-4 sm:px-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div className="flex min-w-0 gap-4 overflow-x-auto"><BoardTab active={mode === "bounties" && view === "open"} onClick={() => { setMode("bounties"); setView("open"); }} label="Bounties" count={bounties.length} /><BoardTab active={mode === "points"} onClick={() => setMode("points")} label="Point exchange" /><BoardTab active={mode === "bounties" && view === "mine"} onClick={() => { setMode("bounties"); setView("mine"); }} label="Mine" /></div><button type="button" onClick={() => { setMode("bounties"); setCreateDialogOpen(true); }} className="inline-flex min-h-9 items-center justify-center gap-2 bg-[var(--hanka-accent)] px-3 text-xs font-semibold text-[var(--hanka-accent-text)] hover:brightness-105"><span className="text-base leading-none">+</span>Create Bounty</button></div>{mode === "bounties" ? <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--hanka-muted)]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Bounty ID, target, source, requester, or commitment" className="h-10 border-[var(--hanka-line)] bg-[#141a16] pl-9 text-xs" /></div><select value={instrumentFilter} onChange={event => setInstrumentFilter(event.target.value as ArcSocialInstrument | "all")} className="h-10 border border-[var(--hanka-line)] bg-[#141a16] px-3 text-xs text-[var(--hanka-text)]"><option value="all">All proof types</option>{socialInstruments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><div className="flex border border-[var(--hanka-line)] bg-[#141a16] p-1">{(["reward", "newest", "ending"] as const).map(value => <button key={value} type="button" onClick={() => setSort(value)} className={`px-3 py-1.5 text-[10px] font-semibold ${sort === value ? "bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]" : "text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]"}`}>{value === "reward" ? "Highest reward" : value === "newest" ? "Newest" : "Ending soon"}</button>)}</div></div> : null}</div>
        {mode === "bounties" ? <BountyBoard records={visibleBounties} metadataByTask={metadataByTask} loading={bountyLoading} busy={busy} wallet={wallet} escrow={Boolean(escrowAddress)} onRefresh={() => void loadBounties()} onAccept={record => void acceptBounty(record)} /> : <PointExchangePanel token={pointToken} setToken={setPointToken} amount={pointAmount} setAmount={setPointAmount} counterparty={counterparty} setCounterparty={setCounterparty} terms={pointTerms} setTerms={setPointTerms} acceptBy={pointAcceptBy} setAcceptBy={setPointAcceptBy} settleBy={settleBy} setSettleBy={setSettleBy} wallet={wallet} busy={busy} escrow={Boolean(escrowAddress)} approve={approve} submit={createPointExchange} />}
      </div></section>
      {mode === "bounties" ? <section className="market-shell pb-8"><BountySideRail featured={featuredBounty} metadata={featuredBounty ? metadataByTask.get(featuredBounty.id.toString()) : undefined} openCount={bounties.length} /></section> : null}
      <section className="market-shell pb-12"><div className="border border-[var(--hanka-line)] bg-[#101713] p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div><p className="hanka-kicker">Existing Bounty actions</p><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">The accepted worker opens a structured delivery submission. The requester releases a valid delivery; either party can open an onchain dispute, which the configured resolver decides.</p></div><Link href="/arc/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--hanka-text)] underline underline-offset-4">Open my Arc activity <ArrowUpRight className="size-3" /></Link></div><div className="mt-5 grid gap-3 lg:grid-cols-[12rem_auto]"><Input value={manageId} onChange={event => setManageId(event.target.value)} inputMode="numeric" placeholder="Accepted Bounty ID" className="border-[var(--hanka-line)] bg-[#0c100e]" /><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!wallet || busy || !escrowAddress} onClick={() => void openSubmission()} className="border-[var(--hanka-line)] bg-transparent">Submit delivery</Button><Button size="sm" disabled={!wallet || busy || !escrowAddress} onClick={() => void manage("approve")} className="bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Release reward</Button><Button size="sm" variant="outline" disabled={!wallet || busy || !escrowAddress} onClick={() => void manage("dispute")} className="border-[var(--hanka-line)] bg-transparent">Dispute</Button></div></div></div></section>
    </main>
    <BountyCreateDialog open={createDialogOpen} setOpen={setCreateDialogOpen} kind={bountyKind} setKind={setBountyKind} token={bountyToken} setToken={setBountyToken} amount={bountyAmount} setAmount={setBountyAmount} title={bountyTitle} setTitle={setBountyTitle} summary={bountySummary} setSummary={setBountySummary} deliverables={deliverables} setDeliverables={setDeliverables} projectSlug={projectSlug} setProjectSlug={setProjectSlug} instrument={bountyInstrument} setInstrument={setBountyInstrument} targetHandle={targetHandle} setTargetHandle={setTargetHandle} proofDetail={proofDetail} setProofDetail={setProofDetail} spaceMinutes={spaceMinutes} setSpaceMinutes={setSpaceMinutes} retentionDays={retentionDays} setRetentionDays={setRetentionDays} featuredToken={featuredToken} setFeaturedToken={setFeaturedToken} location={location} setLocation={setLocation} verificationMethod={verificationMethod} setVerificationMethod={setVerificationMethod} localAttachments={localAttachments} setLocalAttachments={setLocalAttachments} safeAttested={safeAttested} setSafeAttested={setSafeAttested} specificAttested={specificAttested} setSpecificAttested={setSpecificAttested} acceptBy={acceptBy} setAcceptBy={setAcceptBy} dueAt={dueAt} setDueAt={setDueAt} wallet={wallet} busy={busy} escrow={Boolean(escrowAddress)} approve={() => void approve(bountyToken, bountyAmount)} submit={createBounty} />
    <BountySubmissionDialog open={Boolean(submissionBounty)} bountyId={submissionBounty?.id ?? null} bountyTitle={submissionBounty ? metadataByTask.get(submissionBounty.id.toString())?.title : null} deliverables={submissionBounty ? (metadataByTask.get(submissionBounty.id.toString())?.deliverables?.split("\n").filter(Boolean) ?? ["Submit evidence that matches the onchain Bounty terms commitment."]) : []} wallet={wallet} busy={busy} onOpenChange={open => !open && setSubmissionBounty(null)} onSubmit={submitBountyDelivery} />
    <SourceDialog record={sourceEditor} metadata={sourceEditor ? metadataByTask.get(sourceEditor.id.toString()) : undefined} close={() => setSourceEditor(null)} submit={confirmSocialClaim} busy={busy} sourceHandle={sourceHandle} setSourceHandle={setSourceHandle} pointsPerUnit={pointsPerUnit} setPointsPerUnit={setPointsPerUnit} followerCount={followerCount} setFollowerCount={setFollowerCount} ethosScore={ethosScore} setEthosScore={setEthosScore} kaitoScore={kaitoScore} setKaitoScore={setKaitoScore} kaitoAura={kaitoAura} setKaitoAura={setKaitoAura} />
  </div>;
}

function BoardTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) { return <button type="button" onClick={onClick} className={`shrink-0 border-b-2 px-2 py-2 text-xs font-semibold ${active ? "border-[var(--hanka-accent)] text-[var(--hanka-text)]" : "border-transparent text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]"}`}>{label}{typeof count === "number" ? <span className="ml-2 bg-[#1b5131] px-1.5 py-0.5 text-[9px] text-[#b6f4c6]">{count}</span> : null}</button>; }

function BountyBoard({ records, metadataByTask, loading, busy, wallet, escrow, onRefresh, onAccept }: { records: ArcTaskRecord[]; metadataByTask: Map<string, SocialMeta>; loading: boolean; busy: boolean; wallet: string; escrow: boolean; onRefresh: () => void; onAccept: (record: ArcTaskRecord) => void }) {
  return <section><div className="hidden grid-cols-[66px_minmax(210px,1.3fr)_120px_110px_88px_100px] gap-4 border-b border-[var(--hanka-line)] bg-[#141a16] px-5 py-2 text-[9px] font-semibold uppercase tracking-[.12em] text-[var(--hanka-muted)] lg:grid"><span>Status</span><span>Bounty</span><span>Reward</span><span>Time left</span><span>Source</span><span /></div>{loading && !records.length ? <div className="h-64 animate-pulse bg-[#101713]" /> : records.length ? records.map(record => <BountyRow key={record.id.toString()} record={record} meta={metadataByTask.get(record.id.toString())} busy={busy} wallet={wallet} escrow={escrow} onAccept={() => onAccept(record)} />) : <div className="m-5 border border-dashed border-[var(--hanka-line)] p-6 text-sm text-[var(--hanka-muted)]"><p className="font-semibold text-[var(--hanka-text)]">No matching funded Bounties.</p><p className="mt-2 leading-6">This board reads the public Arc Testnet contract. Fund a real Bounty to make it available here; no sample Bounties are invented.</p></div>}<div className="flex items-center justify-between border-t border-[var(--hanka-line)] px-5 py-3"><p className="text-[10px] text-[var(--hanka-muted)]">Public state is refreshed from Arc Testnet.</p><button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--hanka-text)] hover:text-[var(--hanka-accent)]">{loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}Refresh</button></div></section>;
}

function BountyRow({ record, meta, busy, wallet, escrow, onAccept }: { record: ArcTaskRecord; meta?: SocialMeta; busy: boolean; wallet: string; escrow: boolean; onAccept: () => void }) {
  const token = tokenForAddress(record.token);
  const isMine = sameAddress(record.requester, wallet) || sameAddress(record.taker, wallet);
  const hasTaker = record.taker !== "0x0000000000000000000000000000000000000000";
  return <article className="bounty-market-row border-b border-[var(--hanka-line)] px-4 py-4 transition-colors hover:bg-[#141a16] sm:px-5"><div className="grid gap-3 lg:grid-cols-[66px_minmax(210px,1.3fr)_120px_110px_88px_100px] lg:items-center lg:gap-4"><div><span className={`inline-flex px-2 py-1 text-[8px] font-bold uppercase tracking-[.11em] ${Number(record.acceptDeadline) * 1000 - Date.now() < 6 * 3_600_000 ? "bg-[#d7b85a] text-[#181408]" : "bg-[#69d98b] text-[#082111]"}`}>{Number(record.acceptDeadline) * 1000 - Date.now() < 6 * 3_600_000 ? "Ending soon" : "Open"}</span></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold tracking-[-.02em] text-[var(--hanka-text)]">{meta ? `${socialLabel(meta.instrument)} for @${meta.targetHandle}` : `Onchain Bounty #${record.id.toString()}`}</h2>{meta ? <span className="border border-[var(--hanka-line)] px-1.5 py-0.5 text-[8px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{meta.projectSlug}</span> : null}</div><p className="mt-1 truncate text-[10px] text-[var(--hanka-muted)]">{meta?.proofDetail || `Commitment ${shortHash(record.termsHash)} · requester ${shortAddress(record.requester)}`}</p></div><div><p className="font-mono text-sm font-semibold text-[var(--hanka-accent)]">{displayAmount(record.reward, record.tokenDecimals)} {token?.symbol ?? "TOKEN"}</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">funded</p></div><div><p className="text-xs font-medium text-[var(--hanka-text)]">{countdown(record.acceptDeadline)}</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">acceptance</p></div><div><p className="text-xs font-medium text-[var(--hanka-text)]">{meta?.sourceHandle ? `@${meta.sourceHandle}` : "Open"}</p><p className="mt-1 text-[9px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{meta?.pointsPerUnit ? `${compact(meta.pointsPerUnit)} pts` : "source"}</p></div><div>{isMine || hasTaker ? <span className="text-[10px] font-semibold text-[var(--hanka-muted)]">{isMine ? "Yours" : "Taken"}</span> : <Button size="sm" onClick={onAccept} disabled={!wallet || busy || !escrow} className="w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Accept <ArrowUpRight className="ml-1 size-3" /></Button>}</div></div></article>;
}

function BountyCreatePanel(props: any) { const social = props.kind === "social"; return <form onSubmit={props.submit} className="border border-[var(--hanka-line)] bg-[#101713] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="hanka-kicker">Create a Bounty</p><h2 className="mt-2 font-display text-4xl tracking-[-.07em]">Fund the brief.</h2></div><div className="flex border border-[var(--hanka-line)] bg-[#0c100e] p-1"><button type="button" onClick={() => props.setKind("social")} className={`px-3 py-1.5 text-[10px] font-semibold ${social ? "bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]" : "text-[var(--hanka-muted)]"}`}>Social proof</button><button type="button" onClick={() => props.setKind("general")} className={`px-3 py-1.5 text-[10px] font-semibold ${!social ? "bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]" : "text-[var(--hanka-muted)]"}`}>General</button></div></div><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">{social ? "Create a funded request for a vouch, slash, or named social action. The target, proof type, scope, and retention commitment are hashed into the onchain Bounty terms." : "Create any first-come task with its reward locked in the same Arc Testnet escrow lifecycle."}</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Arc Testnet token"><select value={props.token} onChange={event => props.setToken(event.target.value as ArcTokenSymbol)} className="h-10 w-full border border-[var(--hanka-line)] bg-[#0c100e] px-3 text-sm">{ARC_TESTNET_TOKENS.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}</select></Field><Field label="Funded reward"><Input value={props.amount} onChange={(event: any) => props.setAmount(event.target.value)} inputMode="decimal" placeholder="5" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div>{social ? <><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Project"><Input value={props.projectSlug} onChange={(event: any) => props.setProjectSlug(event.target.value)} placeholder="commonsmade" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><Field label="Social proof"><select value={props.instrument} onChange={event => props.setInstrument(event.target.value as ArcSocialInstrument)} className="h-10 w-full border border-[var(--hanka-line)] bg-[#0c100e] px-3 text-sm">{socialInstruments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Target X handle"><Input value={props.targetHandle} onChange={(event: any) => props.setTargetHandle(event.target.value)} placeholder="@target" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><Field label="Retention commitment"><select value={props.retentionDays} onChange={event => props.setRetentionDays(Number(event.target.value))} className="h-10 w-full border border-[var(--hanka-line)] bg-[#0c100e] px-3 text-sm">{retentionOptions.map(days => <option key={days} value={days}>{days} days</option>)}</select></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]"><Field label="Brief / proof scope"><Input value={props.proofDetail} onChange={(event: any) => props.setProofDetail(event.target.value)} placeholder="State exactly what the source should do" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field><Field label="Space minutes"><Input value={props.spaceMinutes} onChange={(event: any) => props.setSpaceMinutes(event.target.value)} inputMode="numeric" placeholder="Optional" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field></div></> : <div className="mt-4"><Field label="Work, evidence, and release criteria"><Textarea value={props.generalBrief} onChange={(event: any) => props.setGeneralBrief(event.target.value)} minLength={8} rows={5} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Accept by"><Input type="datetime-local" value={props.acceptBy} onChange={(event: any) => props.setAcceptBy(event.target.value)} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><Field label="Delivery due"><Input type="datetime-local" value={props.dueAt} onChange={(event: any) => props.setDueAt(event.target.value)} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div><ApprovalCallout token={props.token} amount={props.amount} wallet={props.wallet} busy={props.busy} escrow={props.escrow} approve={() => props.approve(props.token, props.amount)} /><Button type="submit" disabled={!props.wallet || props.busy || !props.escrow} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Fund Arc Bounty <ArrowUpRight className="ml-2 size-4" /></Button></form>; }

function PointExchangePanel(props: any) { return <form className="p-5 sm:p-7" onSubmit={props.submit}><div><p className="hanka-kicker">Point exchange</p><h2 className="mt-2 font-display text-4xl tracking-[-.07em]">Price the future.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">Both named counterparties lock the same token amount. The contract releases only an agreed settlement or a resolver decision.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Arc Testnet token"><select value={props.token} onChange={event => props.setToken(event.target.value as ArcTokenSymbol)} className="h-10 w-full border border-[var(--hanka-line)] bg-[#0c100e] px-3 text-sm">{ARC_TESTNET_TOKENS.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select></Field><Field label="Collateral per party"><Input value={props.amount} onChange={(event: any) => props.setAmount(event.target.value)} inputMode="decimal" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div><div className="mt-4"><Field label="Counterparty EVM wallet"><Input value={props.counterparty} onChange={(event: any) => props.setCounterparty(event.target.value)} placeholder="0x…" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div><div className="mt-4"><Field label="Agreement terms"><Textarea value={props.terms} onChange={(event: any) => props.setTerms(event.target.value)} minLength={8} rows={4} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Counterparty must fund by"><Input type="datetime-local" value={props.acceptBy} onChange={(event: any) => props.setAcceptBy(event.target.value)} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><Field label="Settlement or dispute by"><Input type="datetime-local" value={props.settleBy} onChange={(event: any) => props.setSettleBy(event.target.value)} className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field></div><ApprovalCallout token={props.token} amount={props.amount} wallet={props.wallet} busy={props.busy} escrow={props.escrow} approve={() => props.approve(props.token, props.amount)} /><Button type="submit" disabled={!props.wallet || props.busy || !props.escrow} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Fund point exchange <ArrowUpRight className="ml-2 size-4" /></Button></form>; }

function ApprovalCallout({ token, amount, wallet, busy, escrow, approve }: { token: string; amount: string; wallet: string; busy: boolean; escrow: boolean; approve: () => void }) { return <div className="mt-5 border border-[var(--hanka-line)] bg-[#0c100e] p-4 text-sm"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 size-4 text-[var(--hanka-accent)]" /><div><p className="font-semibold text-[var(--hanka-text)]">Approve the exact {token} amount first.</p><p className="mt-1 text-xs leading-5 text-[var(--hanka-muted)]">Your EVM wallet approves only {amount || "the entered"} testnet tokens for the published contract. HANKA never requests your private key or seed phrase.</p><Button type="button" size="sm" disabled={!wallet || busy || !escrow} onClick={approve} className="mt-3 bg-white text-[#101510] hover:bg-[#e6ece7]">Approve {token}</Button></div></div></div>; }

function BountySideRail({ featured, metadata, openCount }: { featured?: ArcTaskRecord; metadata?: SocialMeta; openCount: number }) { const token = featured ? tokenForAddress(featured.token) : undefined; return <aside className="grid content-start gap-4"><div className="border border-[var(--hanka-line)] bg-[#101713] p-4"><div className="flex items-center justify-between"><p className="hanka-kicker">Highest reward · open</p><span className="arc-mark-tile arc-mark-tile-small"><img src={ARC_MARK_URL} alt="Arc" /></span></div>{featured ? <><p className="mt-4 font-display text-4xl tracking-[-.07em] text-[var(--hanka-accent)]">{displayAmount(featured.reward, featured.tokenDecimals)} {token?.symbol ?? "TOKEN"}</p><p className="mt-2 text-sm font-semibold text-[var(--hanka-text)]">{metadata ? `${socialLabel(metadata.instrument)} for @${metadata.targetHandle}` : `Onchain Bounty #${featured.id.toString()}`}</p><p className="mt-2 text-xs text-[var(--hanka-muted)]">Acceptance closes in {countdown(featured.acceptDeadline)}.</p></> : <p className="mt-4 text-sm leading-6 text-[var(--hanka-muted)]">Fund the first real Bounty to populate this rail.</p>}</div><div className="border border-[var(--hanka-line)] bg-[#101713] p-4"><p className="hanka-kicker">Market state</p><div className="mt-4 grid gap-3"><RailMetric label="Open Bounties" value={String(openCount).padStart(2, "0")} /><RailMetric label="Settlement" value="Arc contract" /><RailMetric label="Network" value="Testnet only" /></div></div><div className="border border-[var(--hanka-line)] bg-[#101713] p-4"><p className="hanka-kicker">Guardrails</p><p className="mt-3 text-xs leading-5 text-[var(--hanka-muted)]">Use faucet tokens only. Contract records contain hashes, addresses, amounts, deadlines, and state. Keep private evidence offchain with the counterparty.</p><a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--hanka-accent)] underline underline-offset-4">Get test tokens <ExternalLink className="size-3" /></a></div></aside>; }

function RailMetric({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-[var(--hanka-line)] pb-3 last:border-0 last:pb-0"><span className="text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{label}</span><span className="text-xs font-semibold text-[var(--hanka-text)]">{value}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-xs font-medium text-[var(--hanka-text)]"><span>{label}</span>{children}</label>; }

function SourceDialog(props: any) { const meta = props.metadata as SocialMeta | undefined; return <Dialog open={Boolean(props.record)} onOpenChange={open => !open && props.close()}><DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--hanka-line)] bg-[#101713] text-[var(--hanka-text)] sm:max-w-xl"><DialogHeader><DialogTitle className="font-display text-3xl tracking-[-.06em]">Claim social Bounty</DialogTitle></DialogHeader><p className="text-sm leading-6 text-[var(--hanka-muted)]">You are claiming {meta ? `${socialLabel(meta.instrument)} for @${meta.targetHandle}` : "this Bounty"}. Confirm the source account before the first-come Arc contract acceptance.</p><form onSubmit={props.submit} className="mt-2 grid gap-4"><Field label="Source X handle"><Input value={props.sourceHandle} onChange={event => props.setSourceHandle(event.target.value)} placeholder="@source" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><Field label="Points per unit"><Input value={props.pointsPerUnit} onChange={event => props.setPointsPerUnit(event.target.value)} inputMode="numeric" placeholder="12000" className="border-[var(--hanka-line)] bg-[#0c100e]" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="X followers"><Input value={props.followerCount} onChange={event => props.setFollowerCount(event.target.value)} inputMode="numeric" placeholder="Optional" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field><Field label="Ethos score"><Input value={props.ethosScore} onChange={event => props.setEthosScore(event.target.value)} inputMode="numeric" placeholder="Optional" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field><Field label="Kaito score"><Input value={props.kaitoScore} onChange={event => props.setKaitoScore(event.target.value)} inputMode="numeric" placeholder="Optional" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field><Field label="Kaito Aura"><Input value={props.kaitoAura} onChange={event => props.setKaitoAura(event.target.value)} inputMode="numeric" placeholder="Optional" className="border-[var(--hanka-line)] bg-[#0c100e]" /></Field></div><div className="border border-[#e6ece7]/20 bg-[#0c100e] p-3 text-xs leading-5 text-[var(--hanka-muted)]">Your source profile is checked before acceptance, then associated with the accepted Arc Bounty. Payout authority remains with the onchain contract.</div><Button type="submit" disabled={props.busy} className="bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">{props.busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Confirm &amp; accept Bounty</Button></form></DialogContent></Dialog>; }
