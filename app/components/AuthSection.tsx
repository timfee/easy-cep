"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Status {
  google: { valid: boolean };
  microsoft: { valid: boolean };
}

export default function AuthSection() {
  const [status, setStatus] = useState<Status>();

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(undefined));
  }, []);

  return (
    <section>
      <h2 className="text-xl font-bold mb-2">Authentication</h2>
      <div className="mb-2 flex items-center gap-2">
        <Link className="underline" href="/api/auth/google">
          Sign in with Google
        </Link>
        {status && <span>{status.google.valid ? "✅" : "❌"}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Link className="underline" href="/api/auth/microsoft">
          Sign in with Microsoft
        </Link>
        {status && <span>{status.microsoft.valid ? "✅" : "❌"}</span>}
      </div>
    </section>
  );
}
