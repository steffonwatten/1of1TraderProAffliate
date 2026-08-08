import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClientWallet,
  useListClientTradingAccounts,
  useCreateClientTransfer,
} from "@workspace/api-client-react";
import { ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

export default function TransferPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: wallet } = useGetClientWallet();
  const { data: accountsData } = useListClientTradingAccounts();
  const [direction, setDirection] = useState<"to_mt5" | "from_mt5">("to_mt5");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const accounts = accountsData?.tradingAccounts ?? [];
  const selected = accounts.find((a) => String(a.id) === accountId);

  const transfer = useCreateClientTransfer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transfer complete" });
        setAmount("");
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Transfer failed", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  const fromLabel = direction === "to_mt5" ? "Wallet" : selected ? `Account ${selected.mt5Login}` : "Trading account";
  const toLabel = direction === "to_mt5" ? (selected ? `Account ${selected.mt5Login}` : "Trading account") : "Wallet";
  const fromBalance = direction === "to_mt5" ? wallet?.balance : selected?.balance;
  const toBalance = direction === "to_mt5" ? selected?.balance : wallet?.balance;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl">Transfer</h1>
      <Card>
        <CardHeader><CardTitle>Move funds</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Trading account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose a trading account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.mt5Login} · {a.accountTypeName ?? "Account"} · {formatMoney(a.balance, a.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="to_mt5">Wallet → Trading account</SelectItem>
                <SelectItem value="from_mt5">Trading account → Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">From</p>
                <p className="text-sm font-semibold">{fromLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground">{formatMoney(fromBalance, "USD")}</p>
            </div>
            <div className="my-2 flex justify-center">
              <ArrowDown className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">To</p>
                <p className="text-sm font-semibold">{toLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground">{formatMoney(toBalance, "USD")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-amount">Amount (USD)</Label>
            <Input id="t-amount" inputMode="decimal" placeholder="e.g. 100.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <Button
            className="w-full"
            disabled={!accountId || !amount || transfer.isPending}
            onClick={() =>
              transfer.mutate({ data: { direction, tradingAccountId: Number(accountId), amount: amount.trim() } })
            }
          >
            {transfer.isPending ? "Transferring…" : "Transfer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
