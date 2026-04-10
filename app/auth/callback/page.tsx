"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  React.useEffect(() => {
    // Supabase automaticky zpracuje ?code= z URL a vymění ho za session
    supabase.auth.getSession().then(() => {
      router.replace("/admin");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-slate-500">Přihlašování přes Discord…</div>
    </div>
  );
}
