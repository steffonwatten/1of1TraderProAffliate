import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrokerTransactions,
  useDecideBrokerTransaction,
  type BrokerAdminTransaction,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate, TX_TYPE_LABELS } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-primary/15 text-primary",
  approved: "bg-[hsl(var(--positive))]/15 text-[hsl(var(--positive))]",
  rejected: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

function DecisionDialog({ tx, onClose }: { tx: BrokerAdminTransaction | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const decide = useDecideBrokerTransaction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Decision applied" });
        setNotes("");
        onClose();
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Decision failed", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  if (!tx) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {TX_TYPE_LABELS[tx.type] ?? tx.type} · {formatMoney(tx.amount, tx.currency)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Client:</span> {tx.clientName} ({tx.clientEmail})</p>
          {tx.reference && <p><span className="text-muted-foreground">Reference:</span> {tx.reference}</p>}
          {tx.cryptoCoin && <p><span className="text-muted-foreground">Coin:</span> {tx.cryptoCoin}</p>}
          {tx.cryptoTxid && <p className="break-all"><span className="text-muted-foreground">Txid:</span> {tx.cryptoTxid}</p>}
          {tx.bankAccount && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">PAY OUT TO</p>
              <p>{tx.bankAccount.beneficiaryName} · {tx.bankAccount.bankName}</p>
              <p className="text-muted-foreground">
                {tx.bankAccount.iban ?? tx.bankAccount.accountNumber}
                {tx.bankAccount.swift ? ` · ${tx.bankAccount.swift}` : ""}
              </p>
            </div>
          )}
          {tx.clientNote && <p><span className="text-muted-foreground">Client note:</span> {tx.clientNote}</p>}
        </div>
        <Textarea placeholder="Admin notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-3">
          <Button
            className="flex-1"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: tx.id, data: { decision: "approved", adminNotes: notes || null } })}
          >
            Approve
          </Button>
          <Button
            className="flex-1"
            variant="destructive"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: tx.id, data: { decision: "rejected", adminNotes: notes || null } })}
          >
            Reject
          </Button>
        </div>
        {tx.type === "withdrawal" && (
          <p className="text-xs text-muted-foreground">
            Approving means you have sent (or will send) the funds to the bank account above. Rejecting
            returns the held amount to the client's wallet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionsPage() {
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<BrokerAdminTransaction | null>(null);
  const { data } = useListBrokerTransactions(tab === "all" ? {} : { status: tab as never });
  const transactions = data?.transactions ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Transactions</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{TX_TYPE_LABELS[t.type] ?? t.type}</TableCell>
                  <TableCell>
                    <p>{t.clientName}</p>
                    <p className="text-xs text-muted-foreground">{t.clientEmail}</p>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(t.amount, t.currency)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent capitalize ${STATUS_BADGE[t.status]}`}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {t.status === "pending" && (t.type.startsWith("deposit") || t.type === "withdrawal") ? (
                      <Button size="sm" onClick={() => setSelected(t)}>Review</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setSelected(t)}>Details</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nothing here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <DecisionDialog tx={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
