import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ArcSocialInstrument } from "@shared/arcBountyTerms";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useState } from "react";

const proofTypes: { value: ArcSocialInstrument; label: string }[] = [
  { value: "vouch", label: "Ethos vouch" }, { value: "slash", label: "Ethos slash" }, { value: "follow", label: "X follow" }, { value: "repost", label: "X repost" }, { value: "comment", label: "X comment" }, { value: "space_listener", label: "X Space listener" }, { value: "space_speaker", label: "X Space speaker" }, { value: "space_contributor", label: "X Space contributor" }, { value: "hanka_points", label: "HANKA Points" },
];

export type SocialOfferInput = {
  sourceHandle: string; subject: string; instrument: ArcSocialInstrument; availability: number; followerCount: number; ethosScore: number; kaitoScore: number; kaitoAura: number; isVerifiedClaim: boolean;
};

export function SocialProofOfferDialog({ open, onOpenChange, wallet, busy, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; wallet: string; busy: boolean; onSubmit: (input: SocialOfferInput) => Promise<void> }) {
  const [sourceHandle, setSourceHandle] = useState("");
  const [subject, setSubject] = useState("");
  const [instrument, setInstrument] = useState<ArcSocialInstrument>("follow");
  const [availability, setAvailability] = useState("1");
  const [followers, setFollowers] = useState("");
  const [ethos, setEthos] = useState("");
  const [kaito, setKaito] = useState("");
  const [aura, setAura] = useState("");
  const [verified, setVerified] = useState(false);
  const number = (value: string) => Math.max(0, Number.parseInt(value || "0", 10) || 0);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({ sourceHandle, subject, instrument, availability: Math.max(1, number(availability)), followerCount: number(followers), ethosScore: number(ethos), kaitoScore: number(kaito), kaitoAura: number(aura), isVerifiedClaim: verified });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="hanka-bounty-dialog max-h-[92dvh] overflow-y-auto border-[var(--hanka-line)] bg-[#0c120e] p-0 text-[var(--hanka-text)] sm:max-w-2xl"><DialogHeader className="border-b border-[var(--hanka-line)] bg-[#111b14] px-5 py-5 sm:px-7"><DialogTitle className="font-display text-4xl tracking-[-.065em]">Sell social proof</DialogTitle><DialogDescription className="mt-2 max-w-xl text-sm leading-6 text-[var(--hanka-muted)]">Publish the social action and source-account metrics you are willing to provide. A buyer can use these stated terms to fund a separate Arc Testnet Bounty.</DialogDescription></DialogHeader><form onSubmit={event => void submit(event)} className="grid gap-6 px-5 py-6 sm:px-7"><section><p className="hanka-kicker">Source account</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Source X handle *"><Input value={sourceHandle} onChange={event => setSourceHandle(event.target.value)} placeholder="@yourhandle" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field><Field label="Project, creator, brand, or individual *"><Input value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g. personal account" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field><Field label="I can sell *"><select value={instrument} onChange={event => setInstrument(event.target.value as ArcSocialInstrument)} className="h-11 w-full border border-[var(--hanka-line)] bg-[#111b14] px-3 text-sm">{proofTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field><Field label="Available units"><Input value={availability} onChange={event => setAvailability(event.target.value)} inputMode="numeric" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" required /></Field></div></section><section><p className="hanka-kicker">Stated source metrics</p><p className="mt-2 text-xs leading-5 text-[var(--hanka-muted)]">These values are self-declared. HANKA does not fabricate, validate, or label them as independently verified in this release.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="X followers"><Input value={followers} onChange={event => setFollowers(event.target.value)} inputMode="numeric" placeholder="24000" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Ethos score"><Input value={ethos} onChange={event => setEthos(event.target.value)} inputMode="numeric" placeholder="Optional" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Kaito score"><Input value={kaito} onChange={event => setKaito(event.target.value)} inputMode="numeric" placeholder="23" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field><Field label="Kaito Aura"><Input value={aura} onChange={event => setAura(event.target.value)} inputMode="numeric" placeholder="20" className="h-11 border-[var(--hanka-line)] bg-[#111b14]" /></Field></div><label className="mt-4 flex cursor-pointer gap-3 border border-[var(--hanka-line)] bg-[#111b14] p-3 text-xs leading-5 text-[var(--hanka-muted)]"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} className="mt-0.5 size-4 accent-[#a5e5b4]" /><span><ShieldCheck className="mr-1 inline size-3.5 text-[var(--hanka-accent)]" />I self-attest that this source account is verified by the relevant platform. HANKA has not independently verified this claim.</span></label></section><section className="border-t border-[var(--hanka-line)] pt-5"><p className="text-xs leading-5 text-[var(--hanka-muted)]">Your EVM wallet signs this offer. It does not fund escrow and you may update it by publishing the same source and proof type again.</p><Button type="submit" disabled={!wallet || busy} className="mt-4 w-full bg-[var(--hanka-accent)] text-[var(--hanka-accent-text)]">PUBLISH SOCIAL OFFER <ArrowUpRight className="ml-2 size-4" /></Button></section></form></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-xs font-semibold"><span>{label}</span>{children}</label>; }
