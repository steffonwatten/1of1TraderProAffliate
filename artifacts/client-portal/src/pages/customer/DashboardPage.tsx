import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useCustomerAuth, customerFetch } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, LineChart, LifeBuoy, AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";
import TradingViewChart from "@/components/portal/TradingViewChart";

// The customer's landing screen. Two questions only: is my subscription live,
// and is the indicator on my charts? Everything else is a link.

type AccessState = { status: string; tradingViewUsername: string | null };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CustomerDashboardPage() {
  const { customer, memberships, hasActiveMembership } = useCustomerAuth();
  const [access, setAccess] = useState<AccessState | null>(null);

  useEffect(() => {
    customerFetch<AccessState>("/tradingview")
      .then(setAccess)
      .catch(() => setAccess(null));
  }, []);

  const primary = memberships[0];
  const accessGranted = access?.status === "granted";
  const accessPending = access?.status === "pending";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{customer?.fullName ? `, ${customer.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Your 1OF1 Trader Pro account at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Subscription</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    hasActiveMembership ? "text-green-400" : "text-amber-400"
                  }`}
                >
                  {hasActiveMembership ? "Active" : primary ? primary.status : "None found"}
                </p>
                {primary?.renewalDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Renews {formatDate(primary.renewalDate)}
                  </p>
                )}
              </div>
              <div
                className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${
                  hasActiveMembership ? "text-green-400" : "text-amber-400"
                }`}
              >
                {hasActiveMembership ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Indicator access</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    accessGranted ? "text-green-400" : accessPending ? "text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {accessGranted ? "Granted" : accessPending ? "Pending" : "Not set up"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {access?.tradingViewUsername ?? "No TradingView username yet"}
                </p>
              </div>
              <div
                className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${
                  accessGranted ? "text-green-400" : accessPending ? "text-amber-400" : "text-primary"
                }`}
              >
                {accessPending ? <Clock className="w-5 h-5" /> : <LineChart className="w-5 h-5" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* The one thing a new customer must do. Shown until it is done. */}
      {!accessGranted && (
        <Card className="bg-primary/5 border-primary/25">
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">
                {accessPending ? "We're adding you to the indicator" : "Get the indicator on your charts"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {accessPending
                  ? "Nothing more to do — we'll email you the moment it's live."
                  : "Tell us your TradingView username and we'll grant you access."}
              </p>
            </div>
            {!accessPending && (
              <Link href="/indicator">
                <Button className="shrink-0">
                  Set up access <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live market chart. The caption is load-bearing: this embed cannot draw
          the 1OF1 indicator, and a customer who expects it here will read its
          absence as a fault. The link is adjacent so the next step is obvious. */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Live market
          </h2>
          <a
            href="https://www.tradingview.com/chart/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
          >
            {accessGranted ? "Open with your indicator" : "Open on TradingView"}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <TradingViewChart
          caption={
            accessGranted
              ? "A live TradingView chart. Your 1OF1 indicator runs on TradingView itself — open the chart there to see it plotted."
              : "A live TradingView chart. The 1OF1 indicator is applied on TradingView once your access is granted."
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/indicator">
          <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="p-5 flex items-center gap-3">
              <LineChart className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium">Indicator Access</p>
                <p className="text-xs text-muted-foreground">Manage your TradingView username</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/support">
          <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="p-5 flex items-center gap-3">
              <LifeBuoy className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium">Support</p>
                <p className="text-xs text-muted-foreground">Message us and track replies</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
