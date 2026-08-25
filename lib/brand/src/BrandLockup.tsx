// The 1OF1 Trader Pro lockup, drawn rather than downloaded.
//
// It replaces a 2.2 MB PNG that was rendered 32 pixels tall — most of that file
// was empty padding and a baked-in grey field, shipped on every page including
// login. This weighs nothing, stays crisp at any size, and works on a dark
// background by construction: the wordmark paints in `currentColor`, so the
// parent's text colour drives it and there is no light-logo/dark-page mismatch
// to remember.
//
// ⚠️ Deliberately uses NO Tailwind classes — only SVG attributes and
// currentColor. When the customer portal needs this too, it moves to a shared
// workspace package as a pure file move. Tailwind 4 does not scan workspace
// packages, so a component that styled itself with utility classes would
// compile, build, and render completely unstyled from inside one.
// See .claude/rules/GENERAL-keeping-it-clean.md.

type BrandLockupProps = {
  /** "full" = arrow + 1OF1 + TRADER PRO. "mark" = the arrow alone, for tight spaces. */
  variant?: "full" | "mark";
  /** Height in CSS pixels; width follows the aspect ratio. */
  height?: number;
  className?: string;
};

// The arrow's gradient endpoints are the two blues from the logo's ribbon.
// Every instance needs its own gradient id or a second instance on the page
// reuses the first one's — hence the suffix.
let gradientSeq = 0;

export default function BrandLockup({
  variant = "full",
  height = 32,
  className,
}: BrandLockupProps) {
  const gid = `brand-arrow-${(gradientSeq += 1)}`;
  const isMark = variant === "mark";
  const viewBox = isMark ? "0 0 48 48" : "0 0 258 48";
  const width = isMark ? height : height * (258 / 48);

  return (
    <svg
      viewBox={viewBox}
      height={height}
      width={width}
      className={className}
      role="img"
      aria-label="1OF1 Trader Pro"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="48" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1749D6" />
          <stop offset="100%" stopColor="#29A8FF" />
        </linearGradient>
      </defs>

      {/* Rising ribbon + head. Stroked rather than a filled outline so it stays
          legible at 24px, where a tapered fill collapses into a smudge. */}
      <path
        d="M5 42 C 16 39, 27 30, 35 13"
        stroke={`url(#${gid})`}
        strokeWidth="6.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M44 4 L 40.5 17.3 L 30.7 7.5 Z" fill={`url(#${gid})`} />

      {!isMark && (
        <>
          <text
            x="58"
            y="33"
            fontFamily="Outfit, Inter, system-ui, sans-serif"
            fontSize="26"
            fontWeight="800"
            letterSpacing="-0.5"
            fill="currentColor"
          >
            1OF1
          </text>
          <line x1="130" y1="14" x2="130" y2="34" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
          <text
            x="142"
            y="30"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize="10.5"
            fontWeight="600"
            letterSpacing="3.2"
            fill="currentColor"
            opacity="0.62"
          >
            TRADER PRO
          </text>
        </>
      )}
    </svg>
  );
}
