import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import type { ClientTransaction } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate, TX_TYPE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-primary/15 text-primary border-transparent",
  approved: "bg-[hsl(var(--positive))]/15 text-[hsl(var(--positive))] border-transparent",
  rejected: "bg-destructive/15 text-destructive border-transparent",
  failed: "bg-destructive/15 text-destructive border-transparent",
};

function txIcon(type: string) {
  if (type.startsWith("deposit")) return ArrowDownToLine;
  if (type === "withdrawal") return ArrowUpFromLine;
  return ArrowLeftRight;
}

function txSign(type: string): "+" | "-" {
  return type.startsWith("deposit") || type === "transfer_from_mt5" ? "+" : "-";
}

export function TransactionList({ transactions, emptyText }: {
  transactions: ClientTransaction[];
  emptyText?: string;
}) {
  if (transactions.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText ?? "No transactions yet."}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {transactions.map((t) => {
        const Icon = txIcon(t.type);
        const sign = txSign(t.type);
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{TX_TYPE_LABELS[t.type] ?? t.type}</p>
              <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-semibold", sign === "+" ? "text-[hsl(var(--positive))]" : "")}>
                {sign}
                {formatMoney(t.amount, t.currency)}
              </p>
              <Badge variant="outline" className={cn("mt-0.5 text-[10px] capitalize", STATUS_STYLES[t.status])}>
                {t.status}
              </Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
