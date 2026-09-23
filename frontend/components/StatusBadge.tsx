import { PUBLIC_STATUS } from "@/lib/api";

export default function StatusBadge({ status }: { status: string }) {
  const label = PUBLIC_STATUS[status] ?? "Received";
  const color =
    label === "Resolved"
      ? "bg-green-100 text-green-800"
      : label === "In review"
        ? "bg-amber-100 text-amber-800"
        : "bg-sky-100 text-sky-800";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${color}`}>
      {label}
    </span>
  );
}
