import { useEffect, useState } from "react";
import { useGetBrokerCryptoAddresses, useUpdateBrokerCryptoAddresses } from "@workspace/api-client-react";
import { Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Row = { coin: string; network: string; address: string };

export function CryptoAddressesCard() {
  const { toast } = useToast();
  const { data } = useGetBrokerCryptoAddresses();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (data?.cryptoAddresses) setRows(data.cryptoAddresses);
  }, [data]);

  const update = useUpdateBrokerCryptoAddresses({
    mutation: {
      onSuccess: () => toast({ title: "Crypto addresses saved" }),
      onError: (err: any) =>
        toast({ title: "Could not save", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  const setCell = (i: number, k: keyof Row) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: e.target.value } : row)));

  const valid = rows.every((r) => r.coin && r.network && r.address);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crypto deposit addresses</CardTitle>
        <p className="text-sm text-muted-foreground">
          Static wallet addresses per coin — deposits arrive directly in your wallets. Deposit-only;
          crypto withdrawals are not offered.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input className="w-24" placeholder="Coin" value={r.coin} onChange={setCell(i, "coin")} />
            <Input className="w-28" placeholder="Network" value={r.network} onChange={setCell(i, "network")} />
            <Input className="flex-1" placeholder="Address" value={r.address} onChange={setCell(i, "address")} />
            <Button size="icon" variant="ghost" onClick={() => setRows((rows) => rows.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <div className="flex justify-between pt-2">
          <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { coin: "", network: "", address: "" }])}>
            <Plus className="mr-1 h-4 w-4" />Add address
          </Button>
          <Button size="sm" disabled={!valid || update.isPending} onClick={() => update.mutate({ data: { cryptoAddresses: rows } })}>
            {update.isPending ? "Saving…" : "Save addresses"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
