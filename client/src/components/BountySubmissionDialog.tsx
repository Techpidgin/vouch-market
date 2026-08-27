import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, FileImage, Link2, Plus, ShieldCheck, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type SubmissionPayload = {
  description: string;
  links: string[];
  attachments: File[];
  confirmedDeliverables: string[];
};

type BountySubmissionDialogProps = {
  open: boolean;
  bountyId: bigint | null;
  bountyTitle?: string | null;
  deliverables: string[];
  wallet: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SubmissionPayload) => Promise<void>;
};

const bytes = (size: number) => size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;

export function BountySubmissionDialog({ open, bountyId, bountyTitle, deliverables, wallet, busy, onOpenChange, onSubmit }: BountySubmissionDialogProps) {
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [complete, setComplete] = useState<boolean[]>([]);
  const [attested, setAttested] = useState(false);

  useEffect(() => { if (open) { setComplete(deliverables.map(() => false)); setDescription(""); setLinks([""]); setFiles([]); setAttested(false); } }, [deliverables, open]);
  const updateLink = (index: number, value: string) => setLinks(current => current.map((item, itemIndex) => itemIndex === index ? value : item));
  const addLink = () => setLinks(current => current.length >= 10 ? current : [...current, ""]);
  const validLinks = links.map(value => value.trim()).filter(Boolean);
  const allComplete = deliverables.length > 0 && complete.every(Boolean);
  const addFiles = (list: FileList | null) => setFiles(current => [...current, ...Array.from(list ?? [])].slice(0, 10));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!allComplete || !description.trim() || !attested) return;
    await onSubmit({ description: description.trim(), links: validLinks, attachments: files, confirmedDeliverables: deliverables });
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="hanka-bounty-dialog max-h-[92dvh] overflow-y-auto border-[var(--hanka-line)] bg-[#0c120e] p-0 text-[var(--hanka-text)] sm:max-w-2xl"><DialogHeader className="border-b border-[var(--hanka-line)] bg-[#111b14] px-5 py-5 sm:px-7"><DialogTitle className="font-display text-4xl tracking-[-.065em]">Describe your submission</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[var(--hanka-muted)]">Add evidence notes and links to support the delivery. The final Arc Testnet transaction commits a delivery hash; it does not upload files or publish your full evidence text onchain.</DialogDescription>{bountyTitle ? <p className="mt-4 border-l-2 border-[var(--hanka-accent)] pl-3 text-xs text-[var(--hanka-text)]">Bounty #{bountyId?.toString()} · {bountyTitle}</p> : null}</DialogHeader><form onSubmit={submit} className="grid gap-7 px-5 py-6 sm:px-7 sm:py-7"><section><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--hanka-accent)]">01 · Confirm deliverables</p><h3 className="mt-1 font-display text-3xl tracking-[-.055em]">Match the committed brief.</h3></div><p className="text-xs font-semibold text-[var(--hanka-muted)]">{complete.filter(Boolean).length}/{deliverables.length} done</p></div><p className="mt-2 text-xs leading-5 text-[var(--hanka-muted)]">Check each item once your evidence covers it. The requester assesses delivery against the terms commitment; either party can use the contract’s dispute path.</p><div className="mt-4 grid gap-2">{deliverables.map((deliverable, index) => <label key={`${index}-${deliverable}`} className="flex cursor-pointer items-start gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-sm"><input type="checkbox" checked={complete[index] ?? false} onChange={event => setComplete(current => current.map((item, itemIndex) => itemIndex === index ? event.target.checked : item))} className="mt-0.5 size-4 accent-[#a5e5b4]" /><span>{deliverable}</span></label>)}</div></section><section><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--hanka-accent)]">02 · Evidence</p><h3 className="mt-1 font-display text-3xl tracking-[-.055em]">Explain what you delivered.</h3><Textarea value={description} onChange={event => setDescription(event.target.value.slice(0, 1_000))} maxLength={1_000} rows={5} required placeholder="Tell the requester what you shipped, where evidence appears, and anything they should review first." className="mt-4 border-[var(--hanka-line)] bg-[#111b14]" /><div className="mt-4 grid gap-2">{links.map((link, index) => <div key={index} className="flex gap-2"><Input value={link} onChange={event => updateLink(index, event.target.value)} type="url" placeholder="https://… (optional evidence link)" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /><button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => setLinks(current => current.length === 1 ? [""] : current.filter((_, itemIndex) => itemIndex !== index))} className="grid size-11 shrink-0 place-items-center border border-[var(--hanka-line)] text-[var(--hanka-muted)] hover:bg-[#172019] hover:text-white"><X className="size-4" /></button></div>)}</div><button type="button" onClick={addLink} disabled={links.length >= 10} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--hanka-accent)] disabled:opacity-50"><Plus className="size-3.5" />ADD LINK</button></section><section><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--hanka-accent)]">03 · Local attachments</p><p className="mt-2 text-xs leading-5 text-[var(--hanka-muted)]">Drag supporting files here or select them. They remain a local preview in this release; share durable evidence through your own link or the delivery reference you agree with the requester.</p><label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--hanka-line)] bg-[#111b14] px-4 text-center hover:border-[var(--hanka-accent)]"><FileImage className="size-5 text-[var(--hanka-accent)]" /><span className="mt-2 text-sm font-semibold">DROP FILES OR SELECT LOCAL FILES</span><span className="mt-1 text-xs text-[var(--hanka-muted)]">Maximum 10 previews · no file is uploaded</span><input className="sr-only" type="file" multiple onChange={event => addFiles(event.currentTarget.files)} /></label>{files.length ? <div className="mt-3 grid gap-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 border border-[var(--hanka-line)] bg-[#111b14] px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{file.name}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[var(--hanka-muted)]">{bytes(file.size)} · local only</p></div><button type="button" onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} className="text-[var(--hanka-muted)] hover:text-white"><X className="size-4" /></button></div>)}</div> : null}</section><section><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[var(--hanka-accent)]">04 · Safety and submission</p><div className="mt-4 border border-[var(--hanka-line)] bg-[#111b14] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--hanka-accent)]" /><p className="text-xs leading-5 text-[var(--hanka-muted)]">Evidence, links, and local previews must not include minors, sexual content, graphic violence or weapons, unpermitted personal data, targeted harassment, or AI-generated work represented as authentic human proof when authenticity is required.</p></div></div><label className="mt-3 flex cursor-pointer items-start gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-xs leading-5 text-[var(--hanka-muted)]"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} className="mt-0.5 size-4 accent-[#a5e5b4]" /><span>I confirm that my submission is truthful, meets each checked deliverable, and follows these content restrictions. I understand the requester can release the reward or either party can open an onchain dispute.</span></label><p className="mt-4 text-xs text-[var(--hanka-muted)]">Submitting as {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "your connected EVM wallet"}. No HANKA submission fee. Network fees may apply.</p><Button type="submit" disabled={busy || !allComplete || !description.trim() || !attested} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">SUBMIT DELIVERY HASH <Check className="ml-2 size-4" /></Button></section></form></DialogContent></Dialog>;
}
