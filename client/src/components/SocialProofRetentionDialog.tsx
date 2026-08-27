import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Link as LinkIcon, ShieldBan } from "lucide-react";
import { useState, type FormEvent } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  busy: boolean;
  onSubmit: (evidenceReference: string) => Promise<void>;
};

export function SocialProofRetentionDialog(props: Props) {
  const [evidenceReference, setEvidenceReference] = useState("");
  const [attested, setAttested] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!attested || evidenceReference.trim().length < 8) return;
    await props.onSubmit(evidenceReference.trim());
    setEvidenceReference("");
    setAttested(false);
  };
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="hanka-bounty-dialog border-[var(--hanka-line)] bg-[#0c120e] p-0 text-[var(--hanka-text)] sm:max-w-xl">
      <DialogHeader className="border-b border-[var(--hanka-line)] bg-[#111b14] px-5 py-5 sm:px-7">
        <DialogTitle className="font-display text-4xl tracking-[-.065em]">Report early removal</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-[var(--hanka-muted)]">Use this only if the completed source account removed a paid follow, repost, vouch, slash, comment, or other agreed proof before its active retention window ended.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-5 px-5 py-6 sm:px-7">
        <div className="border border-[var(--hanka-line)] bg-[#111b14] p-4 text-xs leading-5 text-[var(--hanka-muted)]"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--hanka-accent)]" /><p>Reports do not reverse an onchain payout or decide a contract dispute. They ask the configured Arc resolver to review the retention evidence and, if confirmed, restrict the stated source account from future HANKA social-proof offers and claims.</p></div></div>
        <label className="grid gap-2 text-xs font-semibold"><span>Bounty ID</span><Input readOnly value={props.taskId} className="border-[var(--hanka-line)] bg-[#111b14] text-[var(--hanka-muted)]" /></label>
        <label className="grid gap-2 text-xs font-semibold"><span className="flex items-center gap-2"><LinkIcon className="size-3.5" />Evidence reference *</span><Textarea value={evidenceReference} onChange={event => setEvidenceReference(event.target.value.slice(0, 2000))} rows={5} placeholder="Describe the removed proof and provide a public link, screenshot URL, archive reference, or other verifiable evidence." className="border-[var(--hanka-line)] bg-[#111b14]" required /></label>
        <label className="flex cursor-pointer items-start gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-xs leading-5 text-[var(--hanka-muted)]"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} className="mt-0.5 size-4 accent-[#a5e5b4]" /><span>I am the Bounty requester. I believe this source account removed the agreed social proof before the committed retention window ended, and the evidence reference is truthful.</span></label>
        <Button type="submit" disabled={props.busy || !attested || evidenceReference.trim().length < 8} className="bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]"><ShieldBan className="mr-2 size-4" />SUBMIT RETENTION REPORT</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
