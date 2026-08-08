import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClientTradingAccounts,
  useListClientAccountTypes,
  useCreateClientTradingAccount,
  type CreateClientTradingAccountResponse,
} from "@workspace/api-client-react";
import { Plus, Copy } from "lucide-react";
import { useClientAuth } from "@/lib/clientAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

// Credentials are returned exactly once by the API and never stored — this
// dialog is the only place the client will ever see them.
function CredentialsDialog({ created, onClose }: {
  created: CreateClientTradingAccountResponse | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  if (!created) return null;
  const rows = [
    { label: "Login", value: created.tradingAccount.mt5Login },
    { label: "Master password", value: created.masterPassword },
    { label: "Investor password", value: created.investorPassword },
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Your MT5 credentials</DialogTitle></DialogHeader>
        <p className="text-sm text-primary">
          Save these now — they are shown only once.
        </p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-sm">{r.value}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(r.value);
                    toast({ title: "Copied" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={onClose}>I've saved them</Button>
      </DialogContent>
    </Dialog>
  );
}

function NewAccountDialog({ open, setOpen, onCreated }: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreated: (r: CreateClientTradingAccountResponse) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: typesData } = useListClientAccountTypes();
  const [typeId, setTypeId] = useState("");
  const [leverage, setLeverage] = useState("");

  const types = typesData?.accountTypes ?? [];
  const selectedType = types.find((t) => String(t.id) === typeId);

  const create = useCreateClientTradingAccount({
    mutation: {
      onSuccess: (data) => {
        setOpen(false);
        setTypeId("");
        setLeverage("");
        queryClient.invalidateQueries();
        onCreated(data);
      },
      onError: (err: any) =>
        toast({ title: "Could not create the account", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Open a trading account</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Account type</Label>
            <Select value={typeId} onValueChange={(v) => { setTypeId(v); setLeverage(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose account type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name} — min deposit {formatMoney(t.minDeposit, t.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.description && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Leverage</Label>
            <Select value={leverage} onValueChange={setLeverage} disabled={!selectedType}>
              <SelectTrigger><SelectValue placeholder="Choose leverage" /></SelectTrigger>
              <SelectContent>
                {(selectedType?.leverages ?? []).map((l) => (
                  <SelectItem key={l} value={String(l)}>1:{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!typeId || !leverage || create.isPending}
            onClick={() => create.mutate({ data: { accountTypeId: Number(typeId), leverage: Number(leverage) } })}
          >
            {create.isPending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TradingAccountsPage() {
  const { client } = useClientAuth();
  const { data, isLoading } = useListClientTradingAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<CreateClientTradingAccountResponse | null>(null);

  const accounts = data?.tradingAccounts ?? [];
  const kycApproved = client?.kycStatus === "approved";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">Trading accounts</h1>
        <Button onClick={() => setDialogOpen(true)} disabled={!kycApproved}>
          <Plus className="mr-1 h-4 w-4" />Create new
        </Button>
      </div>

      {!kycApproved && (
        <p className="mb-6 text-sm text-muted-foreground">
          Opening accounts unlocks after{" "}
          <Link href="/verification" className="font-semibold text-primary">identity verification</Link>.
        </p>
      )}

      {isLoading ? null : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No trading accounts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{a.mt5Login}</CardTitle>
                <div className="flex gap-1.5">
                  <Badge variant="secondary">{a.accountTypeName ?? "—"}</Badge>
                  <Badge variant="outline">1:{a.leverage}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">{formatMoney(a.balance, a.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Equity {formatMoney(a.equity, a.currency)} · Free margin {formatMoney(a.marginFree, a.currency)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild variant="secondary" size="sm" className="flex-1">
                    <Link href="/transfer">Fund</Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm" className="flex-1">
                    <Link href="/history">Activity</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewAccountDialog open={dialogOpen} setOpen={setDialogOpen} onCreated={setCreated} />
      <CredentialsDialog created={created} onClose={() => setCreated(null)} />
    </div>
  );
}
