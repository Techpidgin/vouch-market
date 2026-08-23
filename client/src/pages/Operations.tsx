import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, ExternalLink, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

const money = (value: string) => `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`;

export default function Operations() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const operations = trpc.admin.operations.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();
  const payout = trpc.admin.recordPayout.useMutation({ onSuccess: () => operations.refetch() });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 px-1 py-4">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#1c1c1a]/15 pb-7">
          <div>
            <p className="eyebrow">Private operations</p>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Review desk.</h1>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm underline underline-offset-4">
            Public market <ExternalLink size={14} />
          </Link>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Checking access…</p> : !isAdmin ? (
          <div className="border border-[#1c1c1a] bg-[#f1eee5] p-7">
            <ShieldAlert className="mb-3 text-[#ae4d31]" />
            <h2 className="font-display text-2xl">Administrator access required.</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">This area is limited to the site owner. Public market participants cannot view review notes, payment evidence, or payout records.</p>
          </div>
        ) : operations.isLoading ? <p className="text-sm text-muted-foreground">Loading review queue…</p> : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Metric label="Buyer requests" value={operations.data?.requests.length ?? 0} />
              <Metric label="Seller commitments" value={operations.data?.commitments.length ?? 0} />
              <Metric label="Recorded payouts" value={operations.data?.payouts.length ?? 0} />
            </section>

            <section className="grid gap-7 lg:grid-cols-[1.3fr_.7fr]">
              <div className="border border-[#1c1c1a]/20 bg-white">
                <div className="flex items-center justify-between border-b border-[#1c1c1a]/15 px-5 py-4">
                  <h2 className="font-display text-2xl">Completion queue</h2>
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">manual review</span>
                </div>
                <div className="divide-y divide-[#1c1c1a]/10">
                  {operations.data?.commitments.filter(item => item.status === "under_review").length ? operations.data.commitments.filter(item => item.status === "under_review").map(item => (
                    <div key={item.publicId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                      <div>
                        <p className="text-sm font-semibold">{item.publicId} · @{item.profileHandle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.quantity.toLocaleString()} vouches · {money(item.pricePerVouch)} each</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => payout.mutate({ commitmentPublicId: item.publicId, status: "sent", externalReference: "Manual USDC payout" })} disabled={payout.isPending}>
                          <Check size={14} className="mr-1.5" /> Record sent
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => payout.mutate({ commitmentPublicId: item.publicId, status: "withheld", adminNote: "Held for follow-up" })} disabled={payout.isPending}>Hold</Button>
                      </div>
                    </div>
                  )) : <p className="px-5 py-8 text-sm text-muted-foreground">No fully confirmed completions are waiting for review.</p>}
                </div>
              </div>

              <div className="border border-[#1c1c1a]/20 bg-[#1b1b19] p-5 text-[#f4f0e6]">
                <p className="eyebrow text-[#c9c2b2]">Audit trail</p>
                <div className="mt-5 space-y-4">
                  {operations.data?.logs.slice(0, 8).map(log => <div key={log.id} className="border-b border-white/15 pb-3 last:border-0">
                    <p className="text-sm font-medium">{log.eventType.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-[#c9c2b2]">{log.entityPublicId} · {new Date(log.createdAt).toLocaleString()}</p>
                  </div>)}
                </div>
              </div>
            </section>

            <section className="border border-[#1c1c1a]/20 bg-white">
              <div className="border-b border-[#1c1c1a]/15 px-5 py-4"><h2 className="font-display text-2xl">Payment evidence</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f1eee5] text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">Request</th><th className="px-5 py-3">State</th><th className="px-5 py-3">USDC</th><th className="px-5 py-3">Signature</th></tr></thead>
                  <tbody>{operations.data?.requests.map(request => <tr key={request.publicId} className="border-t border-[#1c1c1a]/10"><td className="px-5 py-4 font-medium">{request.publicId}</td><td className="px-5 py-4"><Badge variant="outline">{request.status.replaceAll("_", " ")}</Badge></td><td className="px-5 py-4">{money(request.totalUsdc)}</td><td className="max-w-[210px] truncate px-5 py-4 font-mono text-xs">{request.paymentSignature ?? "—"}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="border border-[#1c1c1a]/20 bg-white p-5"><p className="eyebrow">{label}</p><p className="mt-2 font-display text-4xl tracking-[-0.05em]">{value}</p></div>;
}
