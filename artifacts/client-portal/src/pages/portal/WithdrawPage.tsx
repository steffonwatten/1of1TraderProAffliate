import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClientWallet,
  useListClientBankAccounts,
  useCreateClientBankAccount,
  useDeleteClientBankAccount,
  useCreateClientWithdrawal,
  useListClientTransactions,
} from "@workspace/api-client-react";
import { Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TransactionList } from "@/components/portal/TransactionList";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

function AddBankAccountDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ beneficiaryName: "", bankName: "", iban: "", accountNumber: "", swift: "" });

  const create = useCreateClientBankAccount({
    mutation: {
      onSuccess: () => {
        toast({ title: "Bank account saved" });
        setOpen(false);
        setForm({ beneficiaryName: "", bankName: "", iban: "", accountNumber: "", swift: "" });
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Could not save", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm"><Plus className="mr-1 h-4 w-4" />Add bank account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a bank account</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Beneficiary name</Label>
            <Input value={form.beneficiaryName} onChange={set("beneficiaryName")} placeholder="Name on the account" />
          </div>
          <div className="space-y-2">
            <Label>Bank name</Label>
            <Input value={form.bankName} onChange={set("bankName")} placeholder="Your bank" />
          </div>
          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input value={form.iban} onChange={set("iban")} placeholder="IBAN (or use account number)" />
          </div>
          <div className="space-y-2">
            <Label>Account number</Label>
            <Input value={form.accountNumber} onChange={set("accountNumber")} placeholder="If no IBAN" />
          </div>
          <div className="space-y-2">
            <Label>SWIFT / BIC</Label>
            <Input value={form.swift} onChange={set("swift")} placeholder="Bank code" />
          </div>
          <Button
            className="w-full"
            disabled={!form.beneficiaryName || !form.bankName || (!form.iban && !form.accountNumber) || create.isPending}
            onClick={() =>
              create.mutate({
                data: {
                  beneficiaryName: form.beneficiaryName,
                  bankName: form.bankName,
                  iban: form.iban || null,
                  accountNumber: form.accountNumber || null,
                  swift: form.swift || null,
                },
              })
            }
          >
            {create.isPending ? "Saving…" : "Save bank account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WithdrawPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: wallet } = useGetClientWallet();
  const { data: accountsData } = useListClientBankAccounts();
  const { data: txData } = useListClientTransactions();
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");

  const bankAccounts = accountsData?.bankAccounts ?? [];
  const withdrawals = (txData?.transactions ?? []).filter((t) => t.type === "withdrawal").slice(0, 8);

  const remove = useDeleteClientBankAccount({
    mutation: { onSuccess: () => queryClient.invalidateQueries() },
  });

  const withdraw = useCreateClientWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawal requested", description: "Funds are on hold until it's processed." });
        setAmount("");
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Could not request", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <h1 className="text-2xl">Withdraw</h1>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your bank accounts</CardTitle>
            <AddBankAccountDialog />
          </CardHeader>
          <CardContent>
            {bankAccounts.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Add a bank account to withdraw to.</p>
            ) : (
              <ul className="divide-y divide-border">
                {bankAccounts.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{b.beneficiaryName} · {b.bankName}</p>
                      <p className="text-xs text-muted-foreground">{b.iban ?? b.accountNumber}{b.swift ? ` · ${b.swift}` : ""}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate({ id: b.id })}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request a withdrawal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Available: <span className="font-semibold text-foreground">{formatMoney(wallet?.balance, wallet?.currency)}</span>
            </p>
            <div className="space-y-2">
              <Label>To bank account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Choose a bank account" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.beneficiaryName} · {b.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-amount">Amount (USD)</Label>
              <Input id="w-amount" inputMode="decimal" placeholder="e.g. 250.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Button
              disabled={!bankAccountId || !amount || withdraw.isPending}
              onClick={() => withdraw.mutate({ data: { bankAccountId: Number(bankAccountId), amount: amount.trim() } })}
            >
              {withdraw.isPending ? "Requesting…" : "Request withdrawal"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:col-span-1">
        <CardHeader><CardTitle>Recent withdrawals</CardTitle></CardHeader>
        <CardContent>
          <TransactionList transactions={withdrawals} emptyText="No withdrawals yet." />
        </CardContent>
      </Card>
    </div>
  );
}
