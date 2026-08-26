import { useEffect, useRef, useState } from "react";
import { ExternalLink, WifiOff } from "lucide-react";

// TradingView's Advanced Chart embed.
//
// ⚠️ THIS CHART CANNOT SHOW THE 1OF1 INDICATOR. The public embed only loads
// TradingView's built-in studies; invite-only Pine scripts are not available to
// it, and there is no API that would change that. It is a live market chart and
// nothing more.
//
// That is precisely why every caller must label it honestly. A customer who
// believes their paid indicator should be drawn here will read its absence as a
// broken product and open a support ticket. The `caption` prop is required, not
// optional, so no call site can quietly skip that explanation.
//
// The script is third-party and loaded from s3.tradingview.com at runtime, so
// it can fail: offline, blocked by a network policy, an ad blocker, or a
// corporate proxy. When it does, this renders a link rather than an empty box —
// a blank panel in a paid product looks like a bug, and a customer cannot tell
// the difference between "TradingView is blocked here" and "this is broken".

type TradingViewChartProps = {
  /** Required. Explains what this chart is — and is not. See the note above. */
  caption: string;
  symbol?: string;
  interval?: string;
  height?: number;
};

const EMBED_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

// If no iframe has appeared by now, the script is not coming. Chosen to be
// longer than a slow-but-working load and shorter than a customer's patience.
const LOAD_TIMEOUT_MS = 8000;

export default function TradingViewChart({
  caption,
  symbol = "FX:EURUSD",
  interval = "60",
  height = 460,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // React owns this subtree only as an empty shell — TradingView injects an
    // iframe into it. Clear by hand on every run so a symbol change or a
    // remount cannot stack two charts.
    container.innerHTML = "";
    setFailed(false);

    const script = document.createElement("script");
    script.src = EMBED_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      // Match the portal's card surface so the embed does not sit on the page
      // as an obvious foreign rectangle.
      backgroundColor: "rgba(13, 20, 32, 1)",
      gridColor: "rgba(255, 255, 255, 0.06)",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      support_host: "https://www.tradingview.com",
    });

    script.onerror = () => setFailed(true);
    container.appendChild(script);

    // onerror does not fire for every failure mode — a proxy returning an error
    // page, or a policy that stalls the request, resolves "successfully" with
    // nothing rendered. Check for the iframe instead of trusting the event.
    const timer = window.setTimeout(() => {
      if (!container.querySelector("iframe")) setFailed(true);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      container.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div>
      <div
        className="rounded-xl overflow-hidden border border-border bg-card"
        style={{ height }}
      >
        {failed ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
            <WifiOff className="w-6 h-6 text-muted-foreground" />
            <div>
              <p className="text-white font-medium">Chart unavailable</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                TradingView's chart could not load — that is usually a network or
                ad-blocker issue, not a problem with your account.
              </p>
            </div>
            <a
              href="https://www.tradingview.com/chart/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Open TradingView directly <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div ref={containerRef} className="tradingview-widget-container h-full" />
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{caption}</p>
    </div>
  );
}
