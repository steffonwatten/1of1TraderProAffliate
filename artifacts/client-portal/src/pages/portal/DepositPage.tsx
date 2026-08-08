import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClientDepositMethods,
  useCreateClientDeposit,
  useListClientTransactions,
} from "@workspace/api-client-react";
import { Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionList } from "@/components/portal/TransactionList";
import { useToast } from "@/hooks/use-toast";

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default function DepositPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: methods } = useGetClientDepositMethods();
  const { data: recentData } = useListClientTransactions();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [coin, setCoin] = useState("");
  const [txid, setTxid] = useState("");
  const [tab, setTab] = useState("wire");

  const deposits = (recentData?.transactions ?? []).filter((t) => t.type.startsWith("deposit")).slice(0, 8);

  const create = useCreateClientDeposit({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deposit submitted", description: "We'll credit your wallet once it's confirmed." });
        setAmount("");
        setReference("");
        setTxid("");
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Could not submit", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  const cryptoOptions = methods?.cryptoAddresses ?? [];
  const selected = cryptoOptions.find((c) => `${c.coin}-${c.network}` === coin);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="mb-6 text-2xl">Deposit</h1>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="wire">Bank wire</TabsTrigger>
            <TabsTrigger value="crypto">Crypto</TabsTrigger>
          </TabsList>

          <TabsContent value="wire" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Wire instructions</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border">
                {methods?.wire ? (
                  <>
                    <DetailRow label="Beneficiary" value={methods.wire.beneficiaryName} />
                    <DetailRow label="Bank" value={methods.wire.bankName} />
                    <DetailRow label="IBAN" value={methods.wire.iban} />
                    <DetailRow label="Account number" value={methods.wire.accountNumber} />
                    <DetailRow label="SWIFT / BIC" value={methods.wire.swift} />
                    <DetailRow label="Bank address" value={methods.wire.bankAddress} />
                    {methods.wire.referenceInstructions && (
                      <p className="pt-3 text-sm text-primary">{methods.wire.referenceInstructions}</p>
                    )}
                  </>
                ) : (
                  <p className="py-4 text-sm text-muted-foreground">Wire deposits are not available yet. Contact support.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>I've sent a wire</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wire-amount">Amount (USD)</Label>
                  <Input id="wire-amount" inputMode="decimal" placeholder="e.g. 1000.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wire-ref">Payment reference</Label>
                  <Input id="wire-ref" placeholder="Reference you used on the wire" value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
                <Button
                  disabled={!amount || create.isPending}
                  onClick={() => create.mutate({ data: { method: "wire", amount: amount.trim(), reference: reference || null } })}
                >
                  {create.isPending ? "Submitting…" : "Notify us of your deposit"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crypto" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Send crypto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cryptoOptions.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Crypto deposits are not available yet. Contact support.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Coin</Label>
                      <Select value={coin} onValueChange={setCoin}>
                        <SelectTrigger><SelectValue placeholder="Choose a coin" /></SelectTrigger>
                        <SelectContent>
                          {cryptoOptions.map((c) => (
                            <SelectItem key={`${c.coin}-${c.network}`} value={`${c.coin}-${c.network}`}>
                              {c.coin} · {c.network}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selected && (
                      <div className="rounded-lg border border-border bg-secondary/40 p-4">
                        <p className="mb-1 text-xs text-muted-foreground">
                          {selected.coin} deposit address ({selected.network})
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 break-all text-sm">{selected.address}</code>
                          <Button size="icon" variant="ghost" onClick={() => copy(selected.address)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-primary">
                          Send only {selected.coin} on {selected.network} to this address.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="crypto-amount">Amount (USD value)</Label>
                      <Input id="crypto-amount" inputMode="decimal" placeholder="e.g. 500.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crypto-txid">Transaction hash (txid)</Label>
                      <Input id="crypto-txid" placeholder="Paste the transaction hash" value={txid} onChange={(e) => setTxid(e.target.value)} />
                    </div>
                    <Button
                      disabled={!amount || !selected || create.isPending}
                      onClick={() =>
                        create.mutate({
                          data: {
                            method: "crypto",
                            amount: amount.trim(),
                            cryptoCoin: selected ? `${selected.coin}-${selected.network}` : null,
                            cryptoTxid: txid || null,
                          },
                        })
                      }
                    >
                      {create.isPending ? "Submitting…" : "I've sent the crypto"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Card className="h-fit lg:col-span-1">
        <CardHeader><CardTitle>Recent deposits</CardTitle></CardHeader>
        <CardContent>
          <TransactionList transactions={deposits} emptyText="No deposits yet." />
        </CardContent>
      </Card>
    </div>
  );
}
