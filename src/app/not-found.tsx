import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[100svh] flex-col items-start justify-center gap-6 px-5 sm:px-8 lg:px-12">
      <p className="label">404 · no world at these coordinates</p>
      <h1 className="font-display text-d-2 font-bold wdth-cond">Nothing out here.</h1>
      <Link href="/" data-cursor="button" className="inline-flex h-11 items-center bg-paper px-5 font-mono text-micro uppercase text-void hover:bg-signal-hi">
        Back to the universe
      </Link>
    </section>
  );
}
