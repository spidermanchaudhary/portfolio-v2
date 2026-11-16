"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-[100svh] flex-col items-start justify-center gap-6 px-5 sm:px-8 lg:px-12">
      <p className="label">signal lost</p>
      <h1 className="font-display text-d-2 font-bold wdth-cond">Something broke mid-flight.</h1>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          data-cursor="button"
          className="inline-flex h-11 items-center bg-paper px-5 font-mono text-micro uppercase text-void hover:bg-signal-hi"
        >
          Retry
        </button>
        <Link href="/" data-cursor="button" className="inline-flex h-11 items-center border border-line px-5 font-mono text-micro uppercase text-paper hover:border-paper">
          Back to the universe
        </Link>
      </div>
    </section>
  );
}
