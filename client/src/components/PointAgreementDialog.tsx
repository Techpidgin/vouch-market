import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARC_TESTNET_TOKENS, type ArcTokenSymbol } from "@/lib/arcTestnet";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: ArcTokenSymbol;
  setToken: (value: ArcTokenSymbol) => void;
  amount: string;
  setAmount: (value: string) => void;
  counterparty: string;
  setCounterparty: (value: string) => void;
  terms: string;
  setTerms: (value: string) => void;
  acceptBy: string;
  setAcceptBy: (value: string) => void;
  settleBy: string;
  setSettleBy: (value: string) => void;
  wallet: string;
  busy: boolean;
  approve: () => void;
  submit: (event: FormEvent) => void;
};

export function PointAgreementDialog(props: Props) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="hanka-bounty-dialog max-h-[92dvh] overflow-y-auto border-[var(--hanka-line)] bg-[#0c120e] p-0 text-[var(--hanka-text)] sm:max-w-3xl">
      <DialogHeader className="border-b border-[var(--hanka-line)] bg-[#111b14] px-5 py-5 sm:px-7">
        <DialogTitle className="font-display text-4xl tracking-[-.065em]">Airdrop agreement</DialogTitle>
        <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-[var(--hanka-muted)]">Create a named agreement for an uncertain future airdrop outcome. This is not a guaranteed token sale, price prediction, or promise of eligibility.</DialogDescription>
      </DialogHeader>
      <form onSubmit={props.submit} className="grid gap-7 px-5 py-6 sm:px-7 sm:py-7">
        <section>
          <p className="hanka-kicker">01 · Parties & collateral</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Arc token"><select value={props.token} onChange={event => props.setToken(event.target.value as ArcTokenSymbol)} className="input-dark">{ARC_TESTNET_TOKENS.map(item => <option key={item.symbol}>{item.symbol}</option>)}</select></Field>
            <Field label="Collateral per party"><Input value={props.amount} onChange={event => props.setAmount(event.target.value)} inputMode="decimal" placeholder="50" className="input-dark" required /></Field>
            <Field label="Counterparty EVM wallet"><Input value={props.counterparty} onChange={event => props.setCounterparty(event.target.value)} placeholder="0x…" className="input-dark" required /></Field>
            <Field label="Counterparty must fund by"><Input type="datetime-local" value={props.acceptBy} onChange={event => props.setAcceptBy(event.target.value)} className="input-dark" required /></Field>
          </div>
        </section>
        <section>
          <p className="hanka-kicker">02 · Outcome terms</p>
          <p className="mt-2 text-xs leading-5 text-[var(--hanka-muted)]">Write the exact airdrop claim, evidence standard, and agreed split. Airdrop timing, eligibility, and value remain uncertain and cannot be verified by the contract.</p>
          <Field label="Agreement terms"><Textarea value={props.terms} onChange={event => props.setTerms(event.target.value)} rows={5} className="input-dark mt-4" required /></Field>
          <Field label="Settlement or dispute by"><Input type="datetime-local" value={props.settleBy} onChange={event => props.setSettleBy(event.target.value)} className="input-dark" required /></Field>
        </section>
        <section className="border-t border-[var(--hanka-line)] pt-5">
          <div className="border border-[var(--hanka-line)] bg-[#111b14] p-4"><div className="flex gap-3"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--hanka-accent)]" /><div><p className="text-sm font-semibold">Lock equal collateral on Arc.</p><p className="mt-1 text-xs leading-5 text-[var(--hanka-muted)]">Both named parties deposit the same collateral. Settlement needs matching approvals, or either party may open an onchain dispute for the configured resolver.</p><Button type="button" size="sm" disabled={!props.wallet || props.busy} onClick={props.approve} className="mt-3 bg-white text-[#101510]">APPROVE {props.token}</Button></div></div></div>
          <Button type="submit" disabled={!props.wallet || props.busy} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">FUND AIRDROP AGREEMENT <ArrowUpRight className="ml-2 size-4" /></Button>
        </section>
      </form>
    </DialogContent>
  </Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-4 grid gap-2 text-xs font-semibold"><span>{label}</span>{children}</label>; }
