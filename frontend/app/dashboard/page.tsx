"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { ApiError, api, type DashboardItem, type DashboardSummary } from "@/lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, l] = await Promise.all([api.dashboardSummary(), api.dashboardComplaints()]);
        if (live) {
          setSummary(s);
          setItems(l.items);
        }
      } catch (err) {
        if (live) setError(err instanceof ApiError ? err.message : "Could not load dashboard.");
      } finally {
        if (live) setPending(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const cards: [string, number][] = summary
    ? [
        ["Total complaints", summary.complaints],
        ["SLA breaches", summary.sla_breaches],
        ["Escalations", summary.escalations],
        ["Awaiting triage", summary.needs_triage],
      ]
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Management dashboard</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Anonymised — never shows phone numbers or identities.
      </p>
      {pending && (
        <p aria-live="polite" className="mt-4 text-sm text-neutral-600">
          Loading dashboard…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3" role="region" aria-label="Summary counts">
          {cards.map(([label, n]) => (
            <div key={label} className="rounded bg-white p-4 shadow">
              <p className="text-2xl font-bold">{n}</p>
              <p className="text-sm text-neutral-600">{label}</p>
            </div>
          ))}
        </div>
      )}
      {!pending && !error && items.length === 0 && (
        <p className="mt-4 text-sm text-neutral-600">No complaints yet — file one to see it here.</p>
      )}
      {items.length > 0 && (
        <>
          {/* Mobile: stacked cards */}
          <div className="mt-4 space-y-2 md:hidden">
            {items.map((c) => (
              <div key={c.reference_id} className="rounded bg-white p-3 text-sm shadow">
                <p className="font-mono font-semibold">{c.reference_id}</p>
                <p className="mt-1 text-neutral-600">
                  {c.category.replaceAll("_", " ")} · {c.depot ?? "triage"}
                </p>
                <div className="mt-1">
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <table className="mt-4 hidden w-full text-left text-sm md:table">
            <caption className="sr-only">Recent complaints, newest first</caption>
            <thead>
              <tr className="border-b text-neutral-600">
                <th scope="col" className="py-2">Reference</th>
                <th scope="col">Category</th>
                <th scope="col">Depot</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.reference_id} className="border-b">
                  <td className="py-2 font-mono">{c.reference_id}</td>
                  <td>{c.category.replaceAll("_", " ")}</td>
                  <td>{c.depot ?? "triage"}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
