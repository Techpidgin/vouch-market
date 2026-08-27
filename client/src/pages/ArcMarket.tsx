import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ARC_TESTNET_TOKENS,
  acceptArcPointExchange,
  acceptArcTask,
  approveArcEscrow,
  approveArcPointExchangeSettlement,
  approveArcTask,
  arcExplorerTx,
  connectArcWallet,
  createArcPointExchange,
  createArcTask,
  declineArcPointExchange,
  disputeArcPointExchange,
  disputeArcTask,
  getArcEscrowAddress,
  getArcOpenBounties,
  getArcPointExchangeToken,
  getArcTokenDecimals,
  submitArcTask,
  toTokenUnits,
  type ArcTaskRecord,
  type ArcTokenSymbol,
} from "@/lib/arcTestnet";
import { ARC_MARK_URL } from "@/lib/brandAssets";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, ExternalLink, Filter, Loader2, LockKeyhole, RefreshCw, Search, ShieldCheck, WalletCards } from "lucide-react";
import { formatUnits } from "viem";
import type { Address } from "viem";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const unixFromLocalInput = (value: string, label: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error(`${label} must be in the future.`);
  return Math.floor(timestamp / 1_000);
};
const defaultTime = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString().slice(0, 16);
const shortAddress = (address?: string) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected";
const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-8)}`;
const tokenForAddress = (address: string) => ARC_TESTNET_TOKENS.find(item => item.address.toLowerCase() === address.toLowerCase());
const amountLabel = (amount: bigint, decimals: number) => {
  const [whole, fraction] = formatUnits(amount, decimals).split(".");
  return fraction ? `${whole}.${fraction.slice(0, 4).replace(/0+$/, "") || "0"}` : whole;
};
const dateLabel = (timestamp: bigint) => new Date(Number(timestamp) * 1_000).toLocaleString();
type Mode = "points" | "bounties";
type BountySort = "reward" | "newest" | "ending";

export default function ArcMarket() {
  const [wallet, setWallet] = useState<Address | "">("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("bounties");
  const [token, setToken] = useState<ArcTokenSymbol>("USDC");
  const [amount, setAmount] = useState("50");
  const [counterparty, setCounterparty] = useState("");
  const [pointTerms, setPointTerms] = useState("Airdrop point exchange agreement: both users lock equal collateral under the agreed terms.");
  const [acceptBy, setAcceptBy] = useState(() => defaultTime(60));
  const [settleBy, setSettleBy] = useState(() => defaultTime(24 * 60));
  const [bountyTerms, setBountyTerms] = useState("Describe the bounty steps, delivery evidence, and acceptance criteria here.");
  const [bountyAcceptBy, setBountyAcceptBy] = useState(() => defaultTime(60));
  const [bountyDueAt, setBountyDueAt] = useState(() => defaultTime(24 * 60));
  const [recordId, setRecordId] = useState("");
  const [settlementTerms, setSettlementTerms] = useState("Settlement agreement for this record.");
  const [makerPayout, setMakerPayout] = useState("0");
  const [takerPayout, setTakerPayout] = useState("0");
  const [deliveryTerms, setDeliveryTerms] = useState("Delivery evidence reference and outcome.");
  const [bounties, setBounties] = useState<ArcTaskRecord[]>([]);
  const [bountyLoading, setBountyLoading] = useState(false);
  const [bountyQuery, setBountyQuery] = useState("");
  const [bountySort, setBountySort] = useState<BountySort>("reward");
  const escrowAddress = getArcEscrowAddress();
  const selectedToken = useMemo(() => ARC_TESTNET_TOKENS.find(item => item.symbol === token)!, [token]);

  const loadBounties = async (quiet = false) => {
    if (!escrowAddress) return;
    try {
      setBountyLoading(true);
      const records = await getArcOpenBounties();
      setBounties(records);
      if (!quiet) toast.success("Open Bounties refreshed from Arc Testnet.");
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : "Could not load Bounties.");
    } finally { setBountyLoading(false); }
  };

  useEffect(() => { void loadBounties(true); }, [escrowAddress]);

  const visibleBounties = useMemo(() => {
    const query = bountyQuery.trim().toLowerCase();
    return bounties
      .filter(record => !query || record.id.toString().includes(query) || record.termsHash.toLowerCase().includes(query) || record.requester.toLowerCase().includes(query))
      .sort((left, right) => bountySort === "reward" ? Number(right.reward - left.reward) : bountySort === "ending" ? Number(left.dueAt - right.dueAt) : Number(right.id - left.id));
  }, [bounties, bountyQuery, bountySort]);

  async function connect() {
    try { setBusy(true); const state = await connectArcWallet(); setWallet(state.address); toast.success("Arc Testnet wallet connected."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not connect an Arc wallet."); }
    finally { setBusy(false); }
  }
  const tokenDecimals = () => ("decimals" in selectedToken && typeof selectedToken.decimals === "number") ? selectedToken.decimals : getArcTokenDecimals(selectedToken.address);
  async function approve() {
    try { setBusy(true); const decimals = await tokenDecimals(); const hash = await approveArcEscrow(selectedToken.address, toTokenUnits(amount, decimals)); toast.success("Exact token approval confirmed."); window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Token approval failed."); }
    finally { setBusy(false); }
  }
  async function createPointExchange(event: FormEvent) {
    event.preventDefault();
    try { setBusy(true); const decimals = await tokenDecimals(); const hash = await createArcPointExchange({ token: selectedToken.address, taker: counterparty as Address, collateral: toTokenUnits(amount, decimals), acceptDeadline: unixFromLocalInput(acceptBy, "Acceptance deadline"), settlementDeadline: unixFromLocalInput(settleBy, "Settlement deadline"), terms: pointTerms }); toast.success("Point exchange funding transaction submitted."); window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not fund the point exchange."); }
    finally { setBusy(false); }
  }
  async function createBounty(event: FormEvent) {
    event.preventDefault();
    try { setBusy(true); const decimals = await tokenDecimals(); const hash = await createArcTask({ token: selectedToken.address, reward: toTokenUnits(amount, decimals), acceptDeadline: unixFromLocalInput(bountyAcceptBy, "Bounty acceptance deadline"), dueAt: unixFromLocalInput(bountyDueAt, "Bounty due date"), terms: bountyTerms }); toast.success("Bounty reward funding transaction submitted."); window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer"); window.setTimeout(() => void loadBounties(true), 1_000); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not fund the Bounty reward."); }
    finally { setBusy(false); }
  }
  const parsedRecordId = () => { if (!/^\d+$/.test(recordId)) throw new Error("Enter the numeric onchain exchange or Bounty ID."); return BigInt(recordId); };
  async function manage(action: "acceptPoint" | "approvePoint" | "declinePoint" | "disputePoint" | "acceptBounty" | "submitBounty" | "approveBounty" | "disputeBounty") {
    try {
      setBusy(true);
      const id = parsedRecordId();
      const decimals = action === "approvePoint" ? await getArcTokenDecimals(await getArcPointExchangeToken(id)) : undefined;
      const hash = action === "acceptPoint" ? await acceptArcPointExchange(id)
        : action === "approvePoint" ? await approveArcPointExchangeSettlement(id, settlementTerms, toTokenUnits(makerPayout, decimals!), toTokenUnits(takerPayout, decimals!))
        : action === "declinePoint" ? await declineArcPointExchange(id)
        : action === "disputePoint" ? await disputeArcPointExchange(id)
        : action === "acceptBounty" ? await acceptArcTask(id)
        : action === "submitBounty" ? await submitArcTask(id, deliveryTerms)
        : action === "approveBounty" ? await approveArcTask(id)
        : await disputeArcTask(id);
      toast.success("Arc escrow transaction submitted.");
      window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer");
      window.setTimeout(() => void loadBounties(true), 1_000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit this escrow action."); }
    finally { setBusy(false); }
  }
  async function acceptBounty(record: ArcTaskRecord) { setRecordId(record.id.toString()); await manageWithId("acceptBounty", record.id); }
  async function manageWithId(action: "acceptBounty", id: bigint) {
    try { setBusy(true); const hash = await acceptArcTask(id); toast.success(`Bounty #${id.toString()} accepted.`); window.open(arcExplorerTx(hash), "_blank", "noopener,noreferrer"); window.setTimeout(() => void loadBounties(true), 1_000); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not accept this Bounty."); }
    finally { setBusy(false); }
  }

  return <div className="hanka-app min-h-screen text-[var(--hanka-text)]">
    <header className="hanka-header"><div className="market-shell flex h-16 items-center justify-between gap-3 sm:h-20"><Link href="/" className="font-display text-2xl tracking-[-.07em]">HANKA</Link><nav className="hidden items-center gap-5 text-xs text-[var(--hanka-muted)] sm:flex"><Link href="/market" className="hover:text-[var(--hanka-text)]">Social OTC</Link><Link href="/arc/dashboard" className="hover:text-[var(--hanka-text)]">My Arc activity</Link></nav><Button size="sm" onClick={() => void connect()} disabled={busy} className="bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]"><WalletCards className="mr-2 size-4" />{wallet ? shortAddress(wallet) : "Connect Arc wallet"}</Button></div></header>
    <main>
      <section className="market-hero border-b border-[var(--hanka-line)]"><div className="market-shell py-7 sm:py-10"><Link href="/market" className="hanka-micro inline-flex items-center gap-2 text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]"><ArrowLeft className="size-3" />Social OTC market</Link><div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_21rem]"><div><p className="hanka-kicker text-[#d7bf8c]"><img src={ARC_MARK_URL} alt="" className="size-3.5 object-contain" />Arc Testnet · Contract market</p><h1 className="mt-3 max-w-3xl font-display text-[clamp(3.1rem,6vw,5.75rem)] leading-[.82] tracking-[-.08em]">Fund the outcome.<br />Keep the terms.</h1><p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">Use an Arc wallet for bilateral point exchanges and first-come Bounties. Social proof remains available through the manual OTC market; users on Solana are guided here for contract actions.</p></div><aside className="border border-[#d7bf8c]/40 bg-[#15130c] p-5"><div className="flex items-center gap-2 text-[#e9cd8f]"><ShieldCheck className="size-4" /><p className="hanka-micro">Arc contract status</p></div><p className={`mt-4 text-sm font-semibold ${escrowAddress ? "text-[#a5e5b4]" : "text-[#e9cd8f]"}`}>{escrowAddress ? "Testnet escrow connected" : "Awaiting reviewed contract"}</p><p className="mt-2 break-all font-mono text-[11px] leading-5 text-[#d6d0bf]">{escrowAddress ?? "Set VITE_ARC_TESTNET_ESCROW_ADDRESS to activate user transactions."}</p>{escrowAddress ? <a href={`https://testnet.arcscan.app/address/${escrowAddress}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs text-[#e9cd8f] underline underline-offset-4">Inspect contract <ExternalLink className="size-3" /></a> : null}</aside></div></div></section>
      <section className="market-shell grid gap-5 py-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="overflow-hidden border border-[var(--hanka-line)] bg-[#0d130f]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hanka-line)] px-4 py-3 sm:px-5"><div className="flex"><Tab active={mode === "bounties"} onClick={() => setMode("bounties")} label="Bounties" count={bounties.length} /><Tab active={mode === "points"} onClick={() => setMode("points")} label="Point exchange" /></div><Link href="/arc/dashboard" className="inline-flex items-center gap-1 text-xs text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]">My Arc activity <ArrowUpRight className="size-3" /></Link></div>
          {mode === "bounties" ? <BountyBoard bounties={visibleBounties} query={bountyQuery} setQuery={setBountyQuery} sort={bountySort} setSort={setBountySort} loading={bountyLoading} onRefresh={() => void loadBounties()} onAccept={record => void acceptBounty(record)} disabled={!wallet || busy || !escrowAddress} /> : <PointExchangeForm token={token} setToken={setToken} amount={amount} setAmount={setAmount} counterparty={counterparty} setCounterparty={setCounterparty} terms={pointTerms} setTerms={setPointTerms} acceptBy={acceptBy} setAcceptBy={setAcceptBy} settleBy={settleBy} setSettleBy={setSettleBy} wallet={wallet} busy={busy} escrowAddress={escrowAddress} approve={approve} submit={createPointExchange} />}
          {mode === "bounties" ? <BountyCreateForm token={token} setToken={setToken} amount={amount} setAmount={setAmount} terms={bountyTerms} setTerms={setBountyTerms} acceptBy={bountyAcceptBy} setAcceptBy={setBountyAcceptBy} dueAt={bountyDueAt} setDueAt={setBountyDueAt} wallet={wallet} busy={busy} escrowAddress={escrowAddress} approve={approve} submit={createBounty} /> : null}
          <ManageEscrow mode={mode} recordId={recordId} setRecordId={setRecordId} settlementTerms={settlementTerms} setSettlementTerms={setSettlementTerms} makerPayout={makerPayout} setMakerPayout={setMakerPayout} takerPayout={takerPayout} setTakerPayout={setTakerPayout} deliveryTerms={deliveryTerms} setDeliveryTerms={setDeliveryTerms} disabled={!wallet || busy || !escrowAddress} action={manage} />
        </div>
        <aside className="grid content-start gap-3"><div className="border border-[var(--hanka-line)] bg-[#111b14] p-5"><p className="hanka-kicker">Wallet path</p><div className="mt-4 grid gap-3 text-sm"><PathItem active label="Arc wallet" note="Point exchanges and Bounties use the deployed testnet contract." /><PathItem label="Solana wallet" note="Use Social OTC for manual USDC proof settlement; contract actions prompt Arc." /></div></div><div className="border border-[var(--hanka-line)] bg-[#111b14] p-5"><p className="hanka-kicker">Testnet guardrails</p><p className="mt-3 text-sm leading-6 text-[var(--hanka-muted)]">Use faucet tokens only. No seed phrase or private key is shared with HANKA. Every approval, funding, acceptance, settlement, and dispute is signed by the participant wallet. The contract is the source of truth for onchain escrow state.</p><a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs text-[#d7bf8c] underline underline-offset-4">Get test tokens <ExternalLink className="size-3" /></a></div><Link href="/market" className="border border-[#a5e5b4]/40 bg-[#183123] p-4 text-sm font-semibold text-[#d9f5df] hover:bg-[#21412e]">Need manual social-proof OTC?<span className="mt-1 block text-xs font-normal text-[#b3d9ba]">Open the Solana alternative <ArrowUpRight className="ml-1 inline size-3" /></span></Link></aside>
      </section>
    </main>
  </div>;
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) { return <button type="button" onClick={onClick} className={`border-b-2 px-4 py-3 text-sm ${active ? "border-[var(--hanka-accent)] text-[var(--hanka-text)]" : "border-transparent text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]"}`}>{label}{typeof count === "number" ? <span className="ml-2 rounded-full bg-[#234630] px-1.5 py-0.5 text-[10px] text-[#bce9c5]">{count}</span> : null}</button>; }
function TokenFields({ token, setToken, amount, setAmount, label = "Reward / collateral" }: { token: ArcTokenSymbol; setToken: (value: ArcTokenSymbol) => void; amount: string; setAmount: (value: string) => void; label?: string }) { return <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="arc-token">Arc Testnet settlement token</Label><select id="arc-token" value={token} onChange={event => setToken(event.target.value as ArcTokenSymbol)} className="mt-2 h-10 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm outline-none">{ARC_TESTNET_TOKENS.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}</select></div><div><Label htmlFor="arc-amount">{label}</Label><Input id="arc-amount" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" placeholder="50" className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" required /></div></div>; }
function DateField({ id, label, value, setValue }: { id: string; label: string; value: string; setValue: (value: string) => void }) { return <div><Label htmlFor={id}>{label}</Label><Input id={id} type="datetime-local" value={value} onChange={event => setValue(event.target.value)} className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" required /></div>; }
function PointExchangeForm(props: any) { return <form className="space-y-5 p-5 sm:p-7" onSubmit={props.submit}><section><p className="hanka-kicker text-[#d7bf8c]">New point exchange</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em]">Price the future. Lock the terms.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">Both named counterparties lock the same token amount. Settlement must fit the locked total; HANKA does not set the future airdrop-point value.</p></section><TokenFields token={props.token} setToken={props.setToken} amount={props.amount} setAmount={props.setAmount} label="Collateral each party locks" /><div><Label htmlFor="arc-counterparty">Counterparty EVM wallet</Label><Input id="arc-counterparty" value={props.counterparty} onChange={event => props.setCounterparty(event.target.value)} placeholder="0x…" required className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div><div><Label htmlFor="arc-point-terms">Agreement terms</Label><Textarea id="arc-point-terms" value={props.terms} onChange={event => props.setTerms(event.target.value)} minLength={8} maxLength={2_000} rows={5} className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" required /></div><div className="grid gap-4 sm:grid-cols-2"><DateField id="arc-accept-by" label="Counterparty must fund by" value={props.acceptBy} setValue={props.setAcceptBy} /><DateField id="arc-settle-by" label="Settlement or dispute by" value={props.settleBy} setValue={props.setSettleBy} /></div><ApprovalButton wallet={props.wallet} busy={props.busy} escrow={props.escrowAddress} token={props.token} approve={props.approve} /><Button type="submit" disabled={!props.wallet || props.busy || !props.escrowAddress} className="w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Fund point exchange <ArrowUpRight className="ml-2 size-4" /></Button></form>; }
function BountyCreateForm(props: any) { return <form className="border-t border-[var(--hanka-line)] p-5 sm:p-7" onSubmit={props.submit}><p className="hanka-kicker text-[#d7bf8c]">Create Bounty</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em]">Fund a clear brief.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--hanka-muted)]">The first valid Arc acceptance reserves the Bounty. The contract stores the terms commitment; keep the full brief and delivery evidence offchain with the counterparty.</p><div className="mt-5 space-y-5"><TokenFields token={props.token} setToken={props.setToken} amount={props.amount} setAmount={props.setAmount} label="Bounty reward" /><div><Label htmlFor="arc-bounty-terms">Bounty steps and acceptance criteria</Label><Textarea id="arc-bounty-terms" value={props.terms} onChange={event => props.setTerms(event.target.value)} minLength={8} maxLength={2_000} rows={6} className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" required /></div><div className="grid gap-4 sm:grid-cols-2"><DateField id="arc-bounty-accept-by" label="First worker must accept by" value={props.acceptBy} setValue={props.setAcceptBy} /><DateField id="arc-bounty-due-at" label="Delivery due" value={props.dueAt} setValue={props.setDueAt} /></div><ApprovalButton wallet={props.wallet} busy={props.busy} escrow={props.escrowAddress} token={props.token} approve={props.approve} /><Button type="submit" disabled={!props.wallet || props.busy || !props.escrowAddress} className="w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Fund Bounty reward <ArrowUpRight className="ml-2 size-4" /></Button></div></form>; }
function ApprovalButton({ wallet, busy, escrow, token, approve }: { wallet: string; busy: boolean; escrow: string | null; token: string; approve: () => Promise<void> }) { return <div className="border border-[#e9e5d5]/15 bg-[#111b14] p-4 text-sm leading-6 text-[var(--hanka-muted)]"><p className="font-medium text-[var(--hanka-text)]">1. Approve exact {token} amount</p><p className="mt-1">Your Arc wallet approves the published contract for the entered amount only. No private key is shared with HANKA.</p><Button type="button" size="sm" onClick={() => void approve()} disabled={!wallet || busy || !escrow} className="mt-4 bg-[#d7bf8c] text-[#1a160c] hover:bg-[#ead49f]"><LockKeyhole className="mr-2 size-4" />Approve {token}</Button></div>; }
function BountyBoard({ bounties, query, setQuery, sort, setSort, loading, onRefresh, onAccept, disabled }: { bounties: ArcTaskRecord[]; query: string; setQuery: (value: string) => void; sort: BountySort; setSort: (value: BountySort) => void; loading: boolean; onRefresh: () => void; onAccept: (record: ArcTaskRecord) => void; disabled: boolean }) { return <section><div className="flex flex-col gap-4 border-b border-[var(--hanka-line)] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="hanka-kicker text-[#d7bf8c]">Arc task market</p><h2 className="mt-2 font-display text-4xl tracking-[-.06em]">Open Bounties</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--hanka-muted)]">The board reads only open, funded Bounties from the connected public Arc contract. No demo tasks are shown.</p></div><Button variant="outline" onClick={onRefresh} disabled={loading} className="border-[var(--hanka-line)] bg-transparent text-[var(--hanka-text)] hover:bg-[var(--hanka-panel-strong)]">{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}Refresh</Button></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--hanka-muted)]" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by Bounty ID, requester, or terms hash" className="border-[var(--hanka-line)] bg-[#111b14] pl-9" /></div><div className="flex gap-1 border border-[var(--hanka-line)] bg-[#111b14] p-1">{(["reward", "newest", "ending"] as const).map(value => <button key={value} type="button" onClick={() => setSort(value)} className={`px-3 py-1.5 text-xs ${sort === value ? "bg-[#234630] text-[#d9f5df]" : "text-[var(--hanka-muted)] hover:text-[var(--hanka-text)]"}`}>{value === "reward" ? "Highest reward" : value === "newest" ? "Newest" : "Ending soon"}</button>)}</div></div></div><div className="hidden grid-cols-[60px_minmax(0,1fr)_110px_150px_112px] gap-3 border-b border-[var(--hanka-line)] bg-[#152019] px-5 py-2 text-[10px] uppercase tracking-[.13em] text-[#a4a89b] lg:grid"><span>Status</span><span>Bounty</span><span>Reward</span><span>Time left</span><span /></div>{loading && !bounties.length ? <div className="h-44 animate-pulse bg-[#101612]" /> : bounties.length ? bounties.map(record => <BountyRow key={record.id.toString()} record={record} onAccept={onAccept} disabled={disabled} />) : <div className="m-5 border border-dashed border-[var(--hanka-line)] p-6 text-sm text-[var(--hanka-muted)]"><p className="font-medium text-[var(--hanka-text)]">No open Bounties found.</p><p className="mt-2 leading-6">When a requester funds a real Bounty on this Arc Testnet contract, it appears here. Create the first one below.</p></div>}</section>; }
function BountyRow({ record, onAccept, disabled }: { record: ArcTaskRecord; onAccept: (record: ArcTaskRecord) => void; disabled: boolean }) { const token = tokenForAddress(record.token); return <article className="border-b border-[var(--hanka-line)] px-4 py-4 transition-colors hover:bg-[#152019] sm:px-5"><div className="grid gap-3 lg:grid-cols-[60px_minmax(0,1fr)_110px_150px_112px] lg:items-center"><div><span className="inline-flex border border-[#a5e5b4]/50 bg-[#183123] px-1.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#b8edc2]">Open</span></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-2xl tracking-[-.045em]">Bounty #{record.id.toString()}</h3><span className="font-mono text-[10px] text-[var(--hanka-muted)]">terms {shortHash(record.termsHash)}</span></div><p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.08em] text-[#8d9a8c]">Requester {shortAddress(record.requester)} · acceptance by {dateLabel(record.acceptDeadline)}</p></div><div><p className="font-mono text-base text-[#a5e5b4]">{amountLabel(record.reward, record.tokenDecimals)} {token?.symbol ?? "TOKEN"}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">funded reward</p></div><div><p className="text-sm text-[var(--hanka-text)]">Due {dateLabel(record.dueAt)}</p><p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]"><Clock3 className="size-3" />Onchain deadline</p></div><Button size="sm" onClick={() => onAccept(record)} disabled={disabled} className="bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">Accept Bounty <ArrowUpRight className="ml-1 size-3" /></Button></div></article>; }
function ManageEscrow({ mode, recordId, setRecordId, settlementTerms, setSettlementTerms, makerPayout, setMakerPayout, takerPayout, setTakerPayout, deliveryTerms, setDeliveryTerms, disabled, action }: any) { return <section className="border-t border-[var(--hanka-line)] p-5 sm:p-7"><p className="hanka-kicker">Existing onchain record</p><p className="mt-2 text-sm leading-6 text-[var(--hanka-muted)]">Use the record ID from My Arc activity or ArcScan. Contract state is the settlement source of truth.</p><div className="mt-4"><Label htmlFor="arc-record-id">Point exchange or Bounty ID</Label><Input id="arc-record-id" value={recordId} onChange={event => setRecordId(event.target.value)} inputMode="numeric" placeholder="1" className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div>{mode === "points" ? <><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="arc-maker-payout">Maker settlement payout</Label><Input id="arc-maker-payout" value={makerPayout} onChange={event => setMakerPayout(event.target.value)} inputMode="decimal" className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div><div><Label htmlFor="arc-taker-payout">Counterparty settlement payout</Label><Input id="arc-taker-payout" value={takerPayout} onChange={event => setTakerPayout(event.target.value)} inputMode="decimal" className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div></div><div className="mt-4"><Label htmlFor="arc-settlement-terms">Matching settlement terms</Label><Textarea id="arc-settlement-terms" value={settlementTerms} onChange={event => setSettlementTerms(event.target.value)} rows={3} className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={disabled} onClick={() => void action("acceptPoint")}>Accept &amp; lock collateral</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("approvePoint")}>Approve settlement</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("declinePoint")}>Maker decline</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("disputePoint")}>Open dispute</Button></div></> : <><div className="mt-4"><Label htmlFor="arc-delivery-terms">Delivery evidence reference</Label><Textarea id="arc-delivery-terms" value={deliveryTerms} onChange={event => setDeliveryTerms(event.target.value)} rows={3} className="mt-2 border-[var(--hanka-line)] bg-[#111b14]" /></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={disabled} onClick={() => void action("acceptBounty")}>Accept Bounty</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("submitBounty")}>Submit delivery hash</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("approveBounty")}>Approve payout</Button><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void action("disputeBounty")}>Open dispute</Button></div></>}</section>; }
function PathItem({ active = false, label, note }: { active?: boolean; label: string; note: string }) { return <div className="flex gap-3"><CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${active ? "text-[#a5e5b4]" : "text-[#d7bf8c]"}`} /><div><p className="font-medium text-[var(--hanka-text)]">{label}</p><p className="mt-1 text-xs leading-5 text-[var(--hanka-muted)]">{note}</p></div></div>; }
