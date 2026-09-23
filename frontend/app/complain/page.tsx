"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ApiError, CATEGORIES, api, type ComplaintCreated } from "@/lib/api";

const input =
  "w-full rounded border border-neutral-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-600";

export default function ComplainPage() {
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [bus, setBus] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<ComplaintCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  function validate(): string[] {
    const errs: string[] = [];
    if (!route.trim()) errs.push("Route is required.");
    if (!category) errs.push("Category is required.");
    if (description.trim().length < 10) errs.push("Description needs at least 10 characters.");
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length) {
      summaryRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      const res = await api.createComplaint({
        route_text: route.trim(),
        category,
        description: description.trim(),
        bus_number: bus.trim() || null,
        location_text: location.trim() || null,
        contact_phone: phone.trim() || null,
      });
      setDone(res);
      setTimeout(() => successRef.current?.focus(), 0);
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : "Submission failed — please retry."]);
      summaryRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  if (done) {
    const trackUrl = `/track?ref=${encodeURIComponent(done.reference_id)}`;
    return (
      <div>
        <h1 ref={successRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
          Complaint received
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {done.depot
            ? `Routed to ${done.depot} depot.`
            : "Route not recognised — sent for manual triage."}
        </p>
        <div className="mt-4 flex items-center gap-2 rounded bg-white p-4 shadow">
          <code className="text-lg font-bold tracking-wide">{done.reference_id}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(done.reference_id);
              setCopied(true);
            }}
            className="min-h-[44px] rounded border border-neutral-300 px-4 text-sm"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">Save this ID — it is how you track progress.</p>
        <Link
          href={trackUrl}
          className="mt-4 inline-block min-h-[44px] rounded bg-sky-700 px-6 py-3 text-base font-medium text-white"
        >
          Track complaint
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">File a complaint</h1>
      {errors.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 focus:outline-none"
        >
          <ul className="list-disc pl-5">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <div>
          <label htmlFor="route" className="mb-1 block text-base font-medium">
            Route <span aria-hidden="true">*</span>
          </label>
          <input
            id="route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="As on the bus / ticket, e.g. Adoor - Ernakulam"
            required
            className={input}
          />
          <p className="mt-1 text-sm text-neutral-600">If unsure, write start – end.</p>
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-base font-medium">
            Category <span aria-hidden="true">*</span>
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className={input}
          >
            <option value="">Choose…</option>
            {CATEGORIES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-base font-medium">
            What happened <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            aria-describedby="desc-count"
            className={input}
          />
          <p id="desc-count" className="mt-1 text-sm text-neutral-600">
            {description.trim().length}/10 characters minimum.
          </p>
        </div>
        <details className="rounded border border-neutral-200 bg-white p-3">
          <summary className="cursor-pointer py-2 text-base font-medium">
            Optional details
          </summary>
          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="bus" className="mb-1 block text-base font-medium">
                Bus number
              </label>
              <input id="bus" value={bus} onChange={(e) => setBus(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="location" className="mb-1 block text-base font-medium">
                Stop / landmark
              </label>
              <input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-base font-medium">
                Phone (for depot callback only, never public)
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91…"
                className={input}
              />
            </div>
          </div>
        </details>
        <button
          type="submit"
          disabled={pending}
          className="min-h-[44px] w-full rounded bg-sky-700 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Submit complaint"}
        </button>
        <p aria-live="polite" className="text-sm text-neutral-600">
          {pending ? "Sending your complaint…" : ""}
        </p>
      </form>
    </div>
  );
}
