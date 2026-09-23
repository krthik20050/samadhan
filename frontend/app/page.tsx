import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Public transport grievance portal</h1>
      <p className="mt-2 text-base text-neutral-600">
        Report a bus issue in under a minute, track it by reference ID.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/complain"
          className="min-h-[44px] rounded bg-sky-700 px-6 py-3 text-center text-base font-medium text-white"
        >
          File a complaint
        </Link>
        <Link
          href="/track"
          className="min-h-[44px] rounded border border-neutral-300 bg-white px-6 py-3 text-center text-base font-medium"
        >
          Track by reference ID
        </Link>
      </div>
    </div>
  );
}
