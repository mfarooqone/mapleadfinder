import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold text-neutral-900">WhatsApp Agent</p>
          <div className="flex items-center gap-2">
            <Link href="/signup" className="btn btn-secondary text-sm">
              Sign up
            </Link>
            <Link href="/login" className="btn btn-primary text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          WhatsApp outreach, simplified.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600">
          Manage contacts, send messages, track conversations, and run bulk
          campaigns — all from one clean dashboard.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">
            Open dashboard
          </Link>
          <Link href="/signup" className="btn btn-secondary">
            Create account
          </Link>
          <Link href="/dashboard/whatsapp/setup" className="btn btn-secondary">
            WhatsApp setup
          </Link>
        </div>

        <ul className="mt-12 space-y-3 border-t border-neutral-200 pt-8 text-sm text-neutral-600">
          <li>Connect via WAHA QR scan</li>
          <li>Import contacts and leads</li>
          <li>Send text, voice, and bulk messages</li>
          <li>Auto-reply to incoming messages</li>
        </ul>
      </main>
    </div>
  );
}
