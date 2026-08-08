import { useState } from "react";
import { useListClientTransactions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionList } from "@/components/portal/TransactionList";

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "deposit_wire", label: "Wire deposits" },
  { value: "deposit_crypto", label: "Crypto deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "transfer_to_mt5", label: "Transfers to account" },
  { value: "transfer_from_mt5", label: "Transfers from account" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

export default function TransactionsPage() {
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");

  const { data } = useListClientTransactions({
    ...(type !== "all" ? { type: type as never } : {}),
    ...(status !== "all" ? { status: status as never } : {}),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Transaction history</h1>
        <div className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <TransactionList transactions={data?.transactions ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
