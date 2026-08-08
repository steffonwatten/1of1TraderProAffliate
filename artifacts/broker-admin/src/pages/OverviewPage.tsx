import { Link } from "wouter";
import { useListBrokerClients, useListBrokerTransactions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Derived client-side from the two lists rather than a dedicated overview
// endpoint — at broker scale (hundreds of rows) that is one query each and
// keeps the API surface smaller.
export default function OverviewPage() {
  const { data: clientsData } = useListBrokerClients();
  const { data: pendingData } = useListBrokerTransactions({ status: "pending" });

  const clients = clientsData?.clients ?? [];
  const pending = pendingData?.transactions ?? [];
  const stats = [
    { label: "Clients", value: clients.length, href: "/clients" },
    { label: "KYC awaiting review", value: clients.filter((c) => c.kycStatus === "pending").length, href: "/clients?kyc=pending" },
    { label: "Pending deposits", value: pending.filter((t) => t.type.startsWith("deposit")).length, href: "/transactions" },
    { label: "Pending withdrawals", value: pending.filter((t) => t.type === "withdrawal").length, href: "/transactions" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-extrabold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Work the queues: review KYC under <Link href="/clients" className="text-primary">Clients</Link>, approve
        money movements under <Link href="/transactions" className="text-primary">Transactions</Link>.
      </p>
    </div>
  );
}
