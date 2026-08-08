import { useEffect, useState } from "react";

// The document endpoint streams binary behind admin auth, so a plain <img src>
// can't carry the Bearer header — this is the hand-written fetch fallback the
// plan allows for exactly the two binary endpoints (see SESSION-LOG 1.4).
export function KycDocumentViewer({ documentId, mimeHint }: { documentId: number; mimeHint?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/broker/kyc/documents/${documentId}/file`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") ?? ""}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setIsPdf(blob.type === "application/pdf" || mimeHint === "application/pdf");
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, mimeHint]);

  if (error) return <p className="py-8 text-center text-sm text-destructive">Could not load the document.</p>;
  if (!url) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  if (isPdf) return <iframe src={url} title="KYC document" className="h-[70vh] w-full rounded-lg border border-border" />;
  return <img src={url} alt="KYC document" className="max-h-[70vh] w-full rounded-lg border border-border object-contain" />;
}
