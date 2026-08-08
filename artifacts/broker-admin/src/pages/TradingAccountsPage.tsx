import { useListBrokerTradingAccounts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";

export default function TradingAccountsPage() {
  const { data } = useListBrokerTradingAccounts();
  const accounts = data?.tradingAccounts ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl">Trading accounts</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Leverage</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold">{a.mt5Login}</TableCell>
                  <TableCell>
                    <p>{a.clientName}</p>
                    <p className="text-xs text-muted-foreground">{a.clientEmail}</p>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{a.accountTypeName ?? "—"}</Badge></TableCell>
                  <TableCell>1:{a.leverage}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(a.balance, a.currency)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatMoney(a.equity, a.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No trading accounts yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
