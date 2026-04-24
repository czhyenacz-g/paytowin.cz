"use client";

import React from "react";
import DuelDevShell from "@/app/components/duel/DuelDevShell";
import { useRouter } from "next/navigation";

export default function DuelDevPage() {
  const router = useRouter();
  return (
    <DuelDevShell onExit={() => router.push("/")} />
  );
}
