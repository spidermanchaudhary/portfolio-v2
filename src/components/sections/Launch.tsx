"use client";

import { useRef, useState } from "react";
import { contactDetails, site, socials } from "@/data/site";
import { flight } from "@/store/universe";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const FIELDS = [
  { id: "name", label: "Name", type: "text", placeholder: "Your name", autoComplete: "name" },
  { id: "email", label: "Email", type: "email", placeholder: "you@example.com", autoComplete: "email" },
  { id: "phoneNo", label: "Phone", type: "tel", placeholder: "Your phone number", autoComplete: "tel" },
  { id: "subject", label: "Subject", type: "text", placeholder: "What's this about?", autoComplete: "off" },
] as const;

type FormKey = (typeof FIELDS)[number]["id"] | "message";
const EMPTY: Record<FormKey, string> = { name: "", email: "", phoneNo: "", subject: "", message: "" };

function isDone(id: FormKey, value: string) {
  const v = value.trim();
  if (!v) return false;
  if (id === "email") return /^\S+@\S+\.\S+$/.test(v);
  if (id === "phoneNo") return v.replace(/\D/g, "").length >= 7;
  return true;
}

/**
 * Launch — the contact form as a pre-flight checklist. Each completed field
 * lights a gantry lamp on the launch pad in the canvas (flight.fuel), and a
 * successful send fires the launch sequence (flight.launchAt).
 */
export default function Launch() {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const ticked = useRef(new Set<string>());

  const keys = Object.keys(form) as FormKey[];
  const doneCount = keys.filter((k) => isDone(k, form[k])).length;
  flight.fuel = doneCount / keys.length;

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setForm((f) => ({ ...f, [id]: value }));
    if (state === "error") setState("idle");
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const id = e.target.id as FormKey;
    if (isDone(id, e.target.value)) {
      if (!ticked.current.has(id)) {
        ticked.current.add(id);
        sfx.tick();
      }
    } else ticked.current.delete(id);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keys.some((k) => form[k].trim() === "")) {
      setState("error");
      setMessage("Please fill all the fields.");
      sfx.buzz();
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const res = await fetch(site.contactEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
      setMessage("Message sent successfully!");
      sfx.ding();
      flight.launchAt = performance.now() / 1000;
      setForm(EMPTY);
      ticked.current.clear();
    } catch {
      setState("error");
      setMessage("Failed to send the message. Please try again.");
      sfx.buzz();
    }
  };

  return (
    <section
      id="launch"
      data-station="launch"
      aria-labelledby="launch-title"
      className="relative flex min-h-[100svh] items-center px-5 py-28 sm:px-8 lg:px-12"
    >
      <div className="grid w-full grid-cols-12 gap-x-6 gap-y-14">
        <div className="col-span-12 lg:col-span-5">
          <p className="label mb-4" data-reveal>
            Launch · pre-flight checklist {doneCount}/{keys.length}
          </p>
          <h2 id="launch-title" className="font-display text-d-2 font-bold wdth-cond text-balance" data-split>
            Start a conversation.
          </h2>
          <p className="mt-6 max-w-sm leading-relaxed text-dust text-pretty" data-reveal>
            {site.contactIntro}
          </p>

          <dl className="mt-10 space-y-4" data-reveal>
            {contactDetails.map((d) => (
              <div key={d.label} className="flex items-baseline gap-4">
                <dt className="label w-20 shrink-0">{d.label}</dt>
                <dd className="flex items-baseline gap-3 text-lg">
                  {d.href ? (
                    <a href={d.href} className="link-ink" data-cursor="button">
                      {d.value}
                    </a>
                  ) : (
                    d.value
                  )}
                  {d.copy && <CopyButton value={d.copy} label={d.label} />}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-10 flex flex-wrap gap-x-5 gap-y-2" aria-label="Elsewhere" data-reveal>
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener me"
                  data-cursor="button"
                  data-sfx="out"
                  className="link-ink font-mono text-micro uppercase text-dust hover:text-paper"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          aria-describedby="launch-status"
          className="ticks col-span-12 border border-line bg-void/75 p-5 backdrop-blur-md sm:p-8 lg:col-span-6 lg:col-start-7"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.id} id={f.id} label={f.label} done={isDone(f.id, form[f.id])}>
                <input
                  id={f.id}
                  name={f.id}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={form[f.id]}
                  onChange={onChange}
                  onBlur={onBlur}
                  required
                  className={inputCls}
                />
              </Field>
            ))}
            <div className="sm:col-span-2">
              <Field id="message" label="Message" done={isDone("message", form.message)}>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  placeholder="Type your message here..."
                  value={form.message}
                  onChange={onChange}
                  onBlur={onBlur}
                  required
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <FuelGauge value={doneCount} total={keys.length} />
            <button
              type="submit"
              disabled={state === "sending"}
              data-cursor="button"
              data-magnetic
              data-sfx="none"
              className="group inline-flex h-12 items-center justify-center gap-3 bg-signal px-7 font-mono text-micro uppercase text-paper transition-colors hover:bg-signal-hi hover:text-void disabled:cursor-wait disabled:opacity-60"
            >
              {state === "sending" ? "Igniting…" : doneCount === keys.length ? "Launch message" : "Send message"}
              <span aria-hidden className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-1">
                ↑
              </span>
            </button>
          </div>

          <p id="launch-status" role="status" aria-live="polite" className="mt-5 min-h-5 font-mono text-micro uppercase">
            {message && (
              <span className={state === "sent" ? "text-signal-hi" : "text-alarm"}>
                {state === "sent" ? "✓ " : "✗ "}
                {message}
              </span>
            )}
          </p>
        </form>
      </div>
    </section>
  );
}

const inputCls =
  "w-full border-b border-line bg-transparent px-0 py-2.5 text-lg text-paper placeholder:text-faint transition-colors duration-300 focus:border-signal-hi focus:outline-none focus-visible:outline-none";

function Field({ id, label, done, children }: { id: string; label: string; done: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label flex items-center justify-between">
        <span>{label}</span>
        <span aria-hidden className={cn("transition-colors duration-300", done ? "text-signal-hi" : "text-faint")}>
          {done ? "● go" : "○"}
        </span>
      </label>
      {children}
    </div>
  );
}

function FuelGauge({ value, total }: { value: number; total: number }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-1.5 transition-colors duration-500",
              i < value ? "bg-signal-hi shadow-[0_0_10px_rgb(var(--signal))]" : "bg-line"
            )}
          />
        ))}
      </div>
      <span className="font-mono text-micro uppercase text-dust">
        {value === total ? "all systems go" : `${total - value} to go`}
      </span>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-cursor="button"
      data-sfx="none"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          return;
        }
        sfx.scratch();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={cn("font-mono text-[10px] uppercase tracking-[0.2em] transition-colors", copied ? "text-signal-hi" : "text-faint hover:text-paper")}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}
