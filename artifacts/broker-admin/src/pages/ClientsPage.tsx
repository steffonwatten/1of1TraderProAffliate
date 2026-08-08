import { useState } from "react";
import { Link } from "wouter";
import { useListBrokerClients } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/format";

const KYC_BADGE: Record<string, string> = {
  none: "bg-secondary text-muted-foreground",
  pending: "bg-primary/15 text-primary",
  approved: "bg-[hsl(var(--positive))]/15 text-[hsl(var(--positive))]",
  rejected: "bg-destructive/15 text-destructive",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [kyc, setKyc] = useState("all");
  const { data } = useListBrokerClients({
    ...(search ? { search } : {}),
    ...(kyc !== "all" ? { kycStatus: kyc as never } : {}),
  });
  const clients = data?.clients ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Clients</h1>
        <div className="flex gap-2">
          <Input
            className="w-56"
            placeholder="Search email or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={kyc} onValueChange={setKyc}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KYC states</SelectItem>
              <SelectItem value="pending">KYC pending</SelectItem>
              <SelectItem value="approved">KYC approved</SelectItem>
              <SelectItem value="rejected">KYC rejected</SelectItem>
              <SelectItem value="none">No KYC yet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead className="text-right">Wallet</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </TableCell>
                  <TableCell>{c.country ?? "—"}</TableCell>
                  <TableCell className="capitalize">{c.status.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent capitalize ${KYC_BADGE[c.kycStatus]}`}>
                      {c.kycStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(c.walletBalance)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No clients found.
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
