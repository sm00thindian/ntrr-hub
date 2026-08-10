"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Hub could not load</h1>
        <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.5 }}>
          A client-side error stopped the page. Try again, or hard-refresh (especially if Hub is
          installed as a PWA).
        </p>
        {error?.digest ? (
          <p style={{ color: "#71717a", fontSize: 12, fontFamily: "monospace" }}>
            Digest: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#18181b",
            color: "#fafafa",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
