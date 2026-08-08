import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBrokerAccountTypes,
  useCreateBrokerAccountType,
  useUpdateBrokerAccountType,
} from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

function parseLeverages(text: string): number[] | null {
  const values = text.split(",").map((s) => Number(s.trim())).filter(Boolean);
  return values.length && values.every((v) => Number.isInteger(v) && v > 0) ? values : null;
}

export function AccountTypesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useListBrokerAccountTypes();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mt5Group: "", minDeposit: "0", leverages: "100, 200, 400", description: "" });

  const types = data?.accountTypes ?? [];

  const create = useCreateBrokerAccountType({
    mutation: {
      onSuccess: () => {
        toast({ title: "Account type created" });
        setOpen(false);
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Could not create", description: err?.payload?.message, variant: "destructive" }),
    },
  });
  const update = useUpdateBrokerAccountType({
    mutation: { onSuccess: () => queryClient.invalidateQueries() },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const leverages = parseLeverages(form.leverages);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Account types</CardTitle>
          <p className="text-sm text-muted-foreground">What clients choose when opening an MT5 account.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New type</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>MT5 group</TableHead>
              <TableHead>Min deposit</TableHead>
              <TableHead>Leverages</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">{t.mt5Group}</TableCell>
                <TableCell>{formatMoney(t.minDeposit, t.currency)}</TableCell>
                <TableCell>{t.leverages.map((l) => `1:${l}`).join(", ")}</TableCell>
                <TableCell>
                  <button onClick={() => update.mutate({ id: t.id, data: { isActive: !t.isActive } })}>
                    <Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "Active" : "Off"}</Badge>
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New account type</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={set("name")} placeholder="e.g. Standard" />
            </div>
            <div className="space-y-2">
              <Label>MT5 group</Label>
              <Input value={form.mt5Group} onChange={set("mt5Group")} placeholder="e.g. real\standard" />
            </div>
            <div className="space-y-2">
              <Label>Minimum deposit (USD)</Label>
              <Input value={form.minDeposit} onChange={set("minDeposit")} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Leverages (comma-separated)</Label>
              <Input value={form.leverages} onChange={set("leverages")} placeholder="100, 200, 400" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={set("description")} />
            </div>
            <Button
              className="w-full"
              disabled={!form.name || !form.mt5Group || !leverages || create.isPending}
              onClick={() =>
                create.mutate({
                  data: {
                    name: form.name,
                    mt5Group: form.mt5Group,
                    minDeposit: form.minDeposit || null,
                    leverages: leverages!,
                    description: form.description || null,
                  },
                })
              }
            >
              {create.isPending ? "Creating…" : "Create account type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
