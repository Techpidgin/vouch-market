import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ARC_TESTNET_TOKENS, type ArcTokenSymbol } from "@/lib/arcTestnet";
import type { ArcSocialInstrument } from "@shared/arcBountyTerms";
import { ArrowUpRight, FileImage, LockKeyhole, Plus, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

type RetentionDays = 7 | 14 | 30 | 60 | 90;
type Props = {
  open: boolean; setOpen: (value: boolean) => void;
  kind: "social" | "general"; setKind: (value: "social" | "general") => void;
  token: ArcTokenSymbol; setToken: (value: ArcTokenSymbol) => void;
  amount: string; setAmount: (value: string) => void;
  title: string; setTitle: (value: string) => void;
  summary: string; setSummary: (value: string) => void;
  deliverables: string[]; setDeliverables: (value: string[]) => void;
  projectSlug: string; setProjectSlug: (value: string) => void;
  instrument: ArcSocialInstrument; setInstrument: (value: ArcSocialInstrument) => void;
  targetHandle: string; setTargetHandle: (value: string) => void;
  proofDetail: string; setProofDetail: (value: string) => void;
  spaceMinutes: string; setSpaceMinutes: (value: string) => void;
  retentionDays: RetentionDays; setRetentionDays: (value: RetentionDays) => void;
  featuredToken: string; setFeaturedToken: (value: string) => void;
  location: string; setLocation: (value: string) => void;
  verificationMethod: "onchain_delivery_commitment" | "manual_evidence_reference";
  setVerificationMethod: (value: "onchain_delivery_commitment" | "manual_evidence_reference") => void;
  localAttachments: File[]; setLocalAttachments: (value: File[]) => void;
  safeAttested: boolean; setSafeAttested: (value: boolean) => void;
  specificAttested: boolean; setSpecificAttested: (value: boolean) => void;
  acceptBy: string; setAcceptBy: (value: string) => void;
  dueAt: string; setDueAt: (value: string) => void;
  wallet: string; busy: boolean; escrow: boolean;
  approve: () => void; submit: (event: FormEvent) => void;
};

const proofTypes: { value: ArcSocialInstrument; label: string }[] = [
  { value: "vouch", label: "Ethos vouch" }, { value: "slash", label: "Ethos slash" },
  { value: "follow", label: "X follow" }, { value: "repost", label: "X repost" },
  { value: "comment", label: "X comment" }, { value: "space_listener", label: "X Space listener" },
  { value: "space_speaker", label: "X Space speaker" }, { value: "space_contributor", label: "X Space contributor" },
  { value: "hanka_points", label: "HANKA Points" },
];
const retentionOptions: RetentionDays[] = [7, 14, 30, 60, 90];
const displayBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

export function BountyCreateDialog(props: Props) {
  const isSocial = props.kind === "social";
  const updateDeliverable = (index: number, value: string) => props.setDeliverables(props.deliverables.map((item, itemIndex) => itemIndex === index ? value.slice(0, 100) : item));
  const removeDeliverable = (index: number) => props.setDeliverables(props.deliverables.length === 1 ? [""] : props.deliverables.filter((_, itemIndex) => itemIndex !== index));
  const addFiles = (files: FileList | null) => props.setLocalAttachments([...props.localAttachments, ...Array.from(files ?? [])].slice(0, 10));

  return <Dialog open={props.open} onOpenChange={props.setOpen}>
    <DialogContent className="hanka-bounty-dialog max-h-[92dvh] overflow-y-auto border-[var(--hanka-line)] bg-[#0c120e] p-0 text-[var(--hanka-text)] sm:max-w-3xl">
      <DialogHeader className="border-b border-[var(--hanka-line)] bg-[#111b14] px-5 py-5 sm:px-7">
        <DialogTitle className="font-display text-4xl tracking-[-.065em]">{isSocial ? "Buy social proof" : "Bounty details"}</DialogTitle>
        <DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-[var(--hanka-muted)]">{isSocial ? "Describe the social proof you want to buy, the source requirements, and how long it must remain active. Then fund the request in your EVM wallet." : "Describe what you want done. Next, choose a fixed reward and confirm funding in your EVM wallet."} HANKA commits the specification as an Arc terms hash.</DialogDescription>
      </DialogHeader>
      <form onSubmit={props.submit} className="pointer-events-auto grid gap-7 px-5 py-6 sm:px-7 sm:py-7">
        <section>
          <SectionHead index="01" title={isSocial ? "Your social-proof request" : "The brief"} note={isSocial ? "Set the action, target, source requirements, and retention period. Your funded request becomes a single onchain Bounty." : "Specific, verifiable work helps a claimant decide quickly and gives the requester a clear release standard."} />
          <div className="mt-4 grid gap-4">
            <Field label="Title *" hint={`${props.title.length}/50`}><Input value={props.title} onChange={event => props.setTitle(event.target.value.slice(0, 50))} maxLength={50} placeholder="Describe the outcome in one line" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field>
            <Field label="Summary *" hint={`${props.summary.length}/500`}><Textarea value={props.summary} onChange={event => props.setSummary(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="Explain the task, intended outcome, and what a strong submission looks like." className="border-[var(--hanka-line)] bg-[#111b14]" required /></Field>
          </div>
        </section>
        <section>
          <SectionHead index="02" title="Deliverables *" note="List the specific proof a claimant must deliver. Each item should be concrete and reviewable at a glance." />
          <div className="mt-4 grid gap-2">{props.deliverables.map((item, index) => <div key={`${index}-${item}`} className="flex gap-2"><Input value={item} onChange={event => updateDeliverable(index, event.target.value)} maxLength={100} placeholder={`Deliverable ${index + 1} · 100 characters max`} className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required={index === 0} /><button type="button" aria-label={`Remove deliverable ${index + 1}`} onClick={() => removeDeliverable(index)} className="grid size-11 shrink-0 place-items-center border border-[var(--hanka-line)] text-[var(--hanka-muted)] hover:bg-[#172019] hover:text-white"><X className="size-4" /></button></div>)}</div>
          <div className="mt-3 flex items-center justify-between gap-3"><button type="button" onClick={() => props.setDeliverables(props.deliverables.length < 10 ? [...props.deliverables, ""] : props.deliverables)} disabled={props.deliverables.length >= 10} className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--hanka-accent)] disabled:opacity-50"><Plus className="size-3.5" />ADD DELIVERABLE</button><span className="text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{props.deliverables.length} of 10</span></div>
        </section>
        <section>
          <SectionHead index="03" title="Attachments" note="Optional preview only. Files are not uploaded to the Arc contract or HANKA storage in this release; keep delivery evidence offchain and submit its reference through the Bounty lifecycle." />
          <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--hanka-line)] bg-[#111b14] px-4 text-center hover:border-[var(--hanka-accent)]"><FileImage className="size-5 text-[var(--hanka-accent)]" /><span className="mt-2 text-sm font-semibold">SELECT LOCAL FILES</span><span className="mt-1 text-xs text-[var(--hanka-muted)]">Up to 10 local previews · no file leaves this device</span><input className="sr-only" type="file" multiple onChange={event => addFiles(event.currentTarget.files)} /></label>
          {props.localAttachments.length ? <div className="mt-3 grid gap-2">{props.localAttachments.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 border border-[var(--hanka-line)] bg-[#111b14] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{file.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{displayBytes(file.size)} · local preview</p></div><button type="button" onClick={() => props.setLocalAttachments(props.localAttachments.filter((_, fileIndex) => fileIndex !== index))} className="text-[var(--hanka-muted)] hover:text-white"><X className="size-4" /></button></div>)}</div> : null}
        </section>
        {isSocial ? <section>
          <SectionHead index="04" title="Social-proof scope" note="Name any project, creator, brand, or individual. The social action and recipient are included in the committed Bounty terms." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Project, creator, brand, or individual"><Input value={props.projectSlug} onChange={event => props.setProjectSlug(event.target.value)} placeholder="e.g. a creator or project name" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field>
            <Field label="Social proof"><select value={props.instrument} onChange={event => props.setInstrument(event.target.value as ArcSocialInstrument)} className="h-11 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm">{proofTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
            <Field label="Target X handle"><Input value={props.targetHandle} onChange={event => props.setTargetHandle(event.target.value)} placeholder="@target" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field>
            <Field label="Retention commitment"><select value={props.retentionDays} onChange={event => props.setRetentionDays(Number(event.target.value) as RetentionDays)} className="h-11 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm">{retentionOptions.map(days => <option key={days} value={days}>{days} days</option>)}</select></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]"><Field label="Proof scope"><Input value={props.proofDetail} onChange={event => props.setProofDetail(event.target.value)} placeholder="State exactly what the source should do" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Space minutes"><Input value={props.spaceMinutes} onChange={event => props.setSpaceMinutes(event.target.value)} inputMode="numeric" placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field></div>
          <div className="mt-5 border-t border-[var(--hanka-line)] pt-5"><p className="text-xs font-semibold">Minimum source requirements</p><p className="mt-1 text-xs leading-5 text-[var(--hanka-muted)]">Optional minimums for the account completing this action. HANKA checks the claimant’s self-declared profile in its app flow before the Arc acceptance is sent; the generic escrow contract does not read social-platform data.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Minimum X followers"><Input name="minimumFollowerCount" inputMode="numeric" placeholder="e.g. 20000" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Minimum Ethos score"><Input name="minimumEthosScore" inputMode="numeric" placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Minimum Kaito score"><Input name="minimumKaitoScore" inputMode="numeric" placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Minimum Kaito Aura"><Input name="minimumKaitoAura" inputMode="numeric" placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field></div><label className="mt-4 flex cursor-pointer items-start gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-xs leading-5 text-[var(--hanka-muted)]"><input name="requireVerifiedSource" type="checkbox" className="mt-0.5 size-4 accent-[#a5e5b4]" /><span>Require a claimant to self-attest that their source account is verified by the relevant platform. HANKA does not independently confirm this status in this release.</span></label></div>
        </section> : null}
        <section>
          <SectionHead index="05" title="Reward distribution" note="The current Arc contract has one Bounty taker and one reward recipient. Multi-winner reward splits are not available in this contract version." />
          <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Number of winners"><Input value="1" readOnly aria-readonly className="h-11 border-[var(--hanka-line)] bg-[#111b14] text-[var(--hanka-muted)]" /></Field><Field label="Arc token"><select value={props.token} onChange={event => props.setToken(event.target.value as ArcTokenSymbol)} className="h-11 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm">{ARC_TESTNET_TOKENS.map(token => <option key={token.symbol} value={token.symbol}>{token.symbol}</option>)}</select></Field><Field label="Funded reward"><Input value={props.amount} onChange={event => props.setAmount(event.target.value)} inputMode="decimal" placeholder="5" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field></div>
        </section>
        <section>
          <SectionHead index="06" title="Discovery and verification" note="Optional context helps people recognize a Bounty. QR scanning, geolocation, and third-party automated checks are not currently enabled." />
          <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Featured token"><Input value={props.featuredToken} onChange={event => props.setFeaturedToken(event.target.value)} placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Location"><Input value={props.location} onChange={event => props.setLocation(event.target.value)} placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Verification"><select value={props.verificationMethod} onChange={event => props.setVerificationMethod(event.target.value as "onchain_delivery_commitment" | "manual_evidence_reference")} className="h-11 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm"><option value="onchain_delivery_commitment">Onchain delivery commitment</option><option value="manual_evidence_reference">Manual evidence reference</option></select></Field></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Accept by"><Input type="datetime-local" value={props.acceptBy} onChange={event => props.setAcceptBy(event.target.value)} className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field><Field label="Delivery due"><Input type="datetime-local" value={props.dueAt} onChange={event => props.setDueAt(event.target.value)} className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field></div>
        </section>
        <section>
          <SectionHead index="07" title="Confirmations" note="The requester releases a valid delivery or either party can open an onchain dispute under the contract’s configured resolver." />
          <div className="mt-4 grid gap-3"><CheckRow checked={props.safeAttested} onChange={props.setSafeAttested}>I confirm this Bounty does not request illegal, exploitative, prohibited, harassing, or doxxing activity; work with minors, sexual content, or graphic violence; or AI-generated work misrepresented as authentic human proof.</CheckRow><CheckRow checked={props.specificAttested} onChange={props.setSpecificAttested}>I confirm the title, summary, and deliverables reflect my true intent and are specific enough to review against the Bounty’s committed terms.</CheckRow></div>
        </section>
        <section className="border-t border-[var(--hanka-line)] pt-5"><div className="border border-[var(--hanka-line)] bg-[#111b14] p-4"><div className="flex gap-3"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--hanka-accent)]" /><div><p className="text-sm font-semibold">Approve the exact {props.token} amount, then fund the Bounty.</p><p className="mt-1 text-xs leading-5 text-[var(--hanka-muted)]">Your wallet gives the published Arc contract permission for only the amount you enter. HANKA never requests a seed phrase or private key.</p><Button type="button" size="sm" disabled={!props.wallet || props.busy || !props.escrow} onClick={props.approve} className="mt-3 bg-white text-[#101510] hover:bg-[#e6ece7]">APPROVE {props.token}</Button></div></div></div><Button type="submit" disabled={!props.wallet || props.busy || !props.escrow || !props.safeAttested || !props.specificAttested} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">FUND ARC BOUNTY <ArrowUpRight className="ml-2 size-4" /></Button></section>
      </form>
    </DialogContent>
  </Dialog>;
}

function SectionHead({ index, title, note }: { index: string; title: string; note: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--hanka-accent)]">{index}</p><h3 className="mt-1 font-display text-3xl tracking-[-.055em]">{title}</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--hanka-muted)]">{note}</p></div>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="grid gap-2 text-xs font-semibold"><span className="flex items-center justify-between gap-3"><span>{label}</span>{hint ? <span className="font-normal text-[var(--hanka-muted)]">{hint}</span> : null}</span>{children}</label>; }
function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) { return <label className="flex cursor-pointer items-start gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-xs leading-5 text-[var(--hanka-muted)]"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-0.5 size-4 accent-[#a5e5b4]" /><span>{children}</span></label>; }
