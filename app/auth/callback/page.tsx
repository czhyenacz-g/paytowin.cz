"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    supabase.auth.getSession().then(() => {
      const next = searchParams.get("next") ?? "/";
      router.replace(next);
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500">Přihlašování přes Discord…</div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Přihlašování přes Discord…</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
