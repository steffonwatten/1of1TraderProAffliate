import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetBrokerClientDetail, useDecideBrokerClientKyc } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KycDocumentViewer } from "@/components/KycDocumentViewer";
import { formatMoney, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const DOC_LABELS: Record<string, string> = {
  id_front: "ID — front",
  id_back: "ID — back",
  proof_of_address: "Proof of address",
};

export default function ClientDetailPage({ id }: { id: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetBrokerClientDetail(id);
  const [viewing, setViewing] = useState<{ id: number; label: string } | null>(null);
  const [notes, setNotes] = useState("");

  const decide = useDecideBrokerClientKyc({
    mutation: {
      onSuccess: (r) => {
        toast({ title: `KYC ${r.kycStatus}` });
        setNotes("");
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Decision failed", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  if (isLoading || !data) return null;
  const { client, documents } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{client.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {client.email}{data.phone ? ` · ${data.phone}` : ""}{client.country ? ` · ${client.country}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Wallet</p>
          <p className="text-xl font-bold">{formatMoney(client.walletBalance)}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>KYC review</CardTitle>
          <Badge variant="secondary" className="capitalize">{client.kycStatus}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{DOC_LABELS[d.docType] ?? d.docType}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.originalName} · {formatDate(d.createdAt)} · {d.status}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setViewing({ id: d.id, label: DOC_LABELS[d.docType] ?? d.docType })}>
                    View
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {data.kycNotes && (
            <p className="text-sm text-muted-foreground">Previous note: {data.kycNotes}</p>
          )}
          {client.kycStatus === "pending" && (
            <div className="space-y-3 border-t border-border pt-4">
              <Textarea
                placeholder="Notes for the client (required when rejecting)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id, data: { decision: "approved", notes: notes || null } })}
                >
                  Approve KYC
                </Button>
                <Button
                  variant="destructive"
                  disabled={decide.isPending || !notes}
                  onClick={() => decide.mutate({ id, data: { decision: "rejected", notes } })}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between py-4 text-sm">
          <span className="text-muted-foreground">Trading accounts</span>
          <span className="font-semibold">{data.tradingAccountCount}</span>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{viewing?.label}</DialogTitle></DialogHeader>
          {viewing && <KycDocumentViewer documentId={viewing.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
