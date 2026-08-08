import { Link } from "wouter";
import { useGetClientDashboard, useListClientTradingAccounts } from "@workspace/api-client-react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TransactionList } from "@/components/portal/TransactionList";
import { formatMoney } from "@/lib/format";

export default function DashboardPage() {
  const { data, isLoading } = useGetClientDashboard();
  const { data: accountsData } = useListClientTradingAccounts();
  const accounts = accountsData?.tradingAccounts ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet balance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <p className="text-4xl font-extrabold">
                {formatMoney(data?.walletBalance, data?.currency)}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/deposit"><ArrowDownToLine className="mr-2 h-4 w-4" />Deposit</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/transfer"><ArrowLeftRight className="mr-2 h-4 w-4" />Transfer</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/withdraw"><ArrowUpFromLine className="mr-2 h-4 w-4" />Withdraw</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trading accounts</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/accounts">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No trading accounts yet.{" "}
                <Link href="/accounts" className="font-semibold text-primary">Open one</Link>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {accounts.slice(0, 4).map((a) => (
                  <div key={a.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{a.mt5Login}</span>
                      <Badge variant="secondary">{a.accountTypeName ?? "—"}</Badge>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{formatMoney(a.balance, a.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      Equity {formatMoney(a.equity, a.currency)} · 1:{a.leverage}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Last transactions</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/history">All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={data?.recentTransactions ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
