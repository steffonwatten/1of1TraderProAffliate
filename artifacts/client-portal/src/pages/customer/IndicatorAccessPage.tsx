import { useEffect, useState } from "react";
import { customerFetch } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, XCircle, ExternalLink, AlertTriangle } from "lucide-react";

// Where a customer hands over their TradingView username and sees whether
// access has been granted.
//
// 🔴 This page deliberately does NOT embed a chart. TradingView's public widget
// cannot load invite-only Pine scripts and there is no API to read a customer's
// charts, so an embed here would show a chart WITHOUT the indicator on it —
// which is worse than no chart, because it looks like the product is broken.
// The link goes out to tradingview.com, where the granted access is real.

type AccessState = {
  status: "not_submitted" | "pending" | "granted" | "rejected" | "revoked";
  tradingViewUsername: string | null;
  requestedAt?: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
  chartUrl?: string | null;
};

const STATUS_UI = {
  not_submitted: { icon: AlertTriangle, cls: "text-muted-foreground", label: "Not submitted" },
  pending: { icon: Clock, cls: "text-amber-400", label: "Awaiting approval" },
  granted: { icon: CheckCircle2, cls: "text-green-400", label: "Access granted" },
  rejected: { icon: XCircle, cls: "text-red-400", label: "Not approved" },
  revoked: { icon: XCircle, cls: "text-red-400", label: "Access revoked" },
} as const;

export default function IndicatorAccessPage() {
  const [state, setState] = useState<AccessState | null>(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      const data = await customerFetch<AccessState>("/tradingview");
      setState(data);
      setUsername(data.tradingViewUsername ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your access status.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await customerFetch("/tradingview", {
        method: "PUT",
        body: JSON.stringify({ tradingViewUsername: username }),
      });
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your username.");
    } finally {
      setSaving(false);
    }
  };

  const ui = STATUS_UI[state?.status ?? "not_submitted"];
  const StatusIcon = ui.icon;
  const changed =
    !!state?.tradingViewUsername &&
    username.trim().toLowerCase() !== state.tradingViewUsername.toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Indicator Access</h1>
        <p className="text-muted-foreground mt-1">
          Give us your TradingView username and we'll add the 1OF1 indicator to your account.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${ui.cls}`}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${ui.cls}`}>{ui.label}</p>

              {state?.status === "granted" && (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-white font-medium">{state.tradingViewUsername}</span> has
                    access. Open TradingView and add <span className="text-white">1OF1 Trader Pro</span> from
                    your Invite-only scripts.
                  </p>
                  <a
                    href={state.chartUrl ?? "https://www.tradingview.com/chart/"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
                  >
                    Open TradingView <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              )}

              {state?.status === "pending" && (
                <p className="text-sm text-muted-foreground mt-1">
                  We're adding <span className="text-white font-medium">{state.tradingViewUsername}</span> to
                  the indicator. This is done by hand, usually within a few hours — you'll get an
                  email when it's live.
                </p>
              )}

              {(state?.status === "rejected" || state?.status === "revoked") && (
                <p className="text-sm text-muted-foreground mt-1">
                  {state.decisionNote ?? "Contact support and we'll sort it out."}
                </p>
              )}

              {state?.status === "not_submitted" && (
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your username below to get started.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="tv">TradingView username</Label>
              <Input
                id="tv"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. SteffonW"
                autoComplete="off"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Your username, not your email — find it under your TradingView profile menu.
              </p>
            </div>

            {changed && state?.status === "granted" && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  Changing your username means access has to be granted again — you'll go back into
                  the queue until we've added the new one.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {saved && !error && <p className="text-sm text-green-400">Saved.</p>}

            <Button type="submit" disabled={saving || !username.trim()}>
              {saving ? "Saving…" : state?.tradingViewUsername ? "Update username" : "Submit username"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
