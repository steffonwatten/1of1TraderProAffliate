import { Link } from "wouter";
import { ShieldAlert, Clock } from "lucide-react";
import { useClientAuth } from "@/lib/clientAuth";

// One banner, shown everywhere, until identity is approved — opening trading
// accounts is blocked server-side until then, so keep the path obvious.
export function KycBanner() {
  const { client } = useClientAuth();
  if (!client || client.kycStatus === "approved") return null;

  if (client.kycStatus === "pending") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm">
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        <span>
          Your identity documents are <strong>under review</strong>. You'll be able to open trading
          accounts once they're approved.
        </span>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
      <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
      <span>
        {client.kycStatus === "rejected"
          ? "Your identity check needs attention. "
          : "Verify your identity to unlock trading. "}
        <Link href="/verification" className="font-semibold text-primary underline">
          {client.kycStatus === "rejected" ? "Upload new documents" : "Start verification"}
        </Link>
      </span>
    </div>
  );
}
