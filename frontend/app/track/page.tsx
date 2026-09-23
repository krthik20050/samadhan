"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { ApiError, api, type TrackedComplaint } from "@/lib/api";

function dueText(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
  return `Due in ${days} day${days === 1 ? "" : "s"} (${d.toLocaleDateString()})`;
}

function TrackInner() {
  const params = useSearchParams();
  const [ref, setRef] = useState(params.get("ref") ?? "");
  const [data, setData] = useState<TrackedComplaint | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  async function lookup(value: string) {
    const norm = value.trim().toUpperCase();
    if (!norm) return;
    setPending(true);
    setError("");
    try {
      setData(await api.track(norm));
      setTimeout(() => resultsRef.current?.focus(), 0);
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError ? err.message : "Lookup failed — please retry.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    const q = params.get("ref");
    if (q) {
      setRef(q);
      void lookup(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold">Track complaint</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(ref);
        }}
        className="mt-3 flex gap-2"
      >
        <label htmlFor="ref" className="sr-only">
          Complaint reference ID
        </label>
        <input
          id="ref"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="KSRTC-2026-XXXXXX"
          autoComplete="off"
          className="min-h-[44px] flex-1 rounded border border-neutral-300 px-3 text-base uppercase focus:outline-none focus:ring-2 focus:ring-sky-600"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-[44px] rounded bg-sky-700 px-6 text-base font-medium text-white disabled:opacity-60"
        >
          {pending ? "…" : "Track"}
        </button>
      </form>
      <p aria-live="polite" className="mt-2 text-sm text-neutral-600">
        {pending ? "Looking up…" : ""}
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {data && (
        <div className="mt-4 rounded bg-white p-4 shadow">
          <h2 ref={resultsRef} tabIndex={-1} className="text-base font-semibold focus:outline-none">
            {data.reference_id}
          </h2>
          <div className="mt-2">
            <StatusBadge status={data.status} />
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-neutral-600">Depot:</dt>
              <dd>{data.depot ?? "Triage pending"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-neutral-600">SLA:</dt>
              <dd>{dueText(data.sla_due_at)}</dd>
            </div>
          </dl>
          <h3 className="mt-4 text-sm font-semibold">Progress</h3>
          <ol className="mt-1 space-y-2">
            {data.history.map((h, i) => (
              <li key={i} className="text-sm">
                <time className="text-neutral-600">{new Date(h.created_at).toLocaleString()}</time>
                {" — "}
                {h.from_status ? `${h.from_status} → ` : ""}
                <strong>{h.to_status.replaceAll("_", " ")}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense>
      <TrackInner />
    </Suspense>
  );
}
