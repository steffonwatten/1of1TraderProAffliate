import { useCustomerAuth } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Mail, Calendar, ShieldCheck } from "lucide-react";

// Account details, read-only.
//
// Email and name are NOT editable here on purpose: they come from the Whop
// purchase record, and letting the portal overwrite them would put two systems
// in disagreement about who the customer is. Changing them is a support
// request, which is why that is the only action offered.

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CustomerAccountPage() {
  const { customer, memberships } = useCustomerAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account</h1>
        <p className="text-muted-foreground mt-1">Your details and subscription history.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Mail className="w-[18px] h-[18px] text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-white break-all">{customer?.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-[18px] h-[18px] text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-white">{customer?.fullName ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-[18px] h-[18px] text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-white">{formatDate(customer?.createdAt ?? null)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Subscriptions
        </h2>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subscription found on this account. If you've just purchased, it can take a few
                minutes to appear.
              </p>
            ) : (
              <div className="space-y-3">
                {memberships.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          m.status === "active" || m.status === "trialing"
                            ? "text-green-400"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-white capitalize">{m.status}</span>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {m.renewalDate ? `Renews ${formatDate(m.renewalDate)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <p className="text-white font-medium">Need your email or name changed?</p>
          <p className="text-sm text-muted-foreground mt-1">
            These come from your purchase record, so we update them for you — send a message from
            the Support tab and we'll take care of it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
