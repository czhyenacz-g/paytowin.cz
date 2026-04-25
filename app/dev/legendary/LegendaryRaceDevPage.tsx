"use client";

import React from "react";
import LegendaryRaceDevShell from "@/app/components/legendary/LegendaryRaceDevShell";
import { useRouter } from "next/navigation";

export default function LegendaryRaceDevPage() {
  const router = useRouter();
  return <LegendaryRaceDevShell onExit={() => router.push("/")} />;
}
