"use client";

import React from "react";
import SpeedDevShell from "@/app/components/speed/SpeedDevShell";
import { useRouter } from "next/navigation";

export default function SpeedDevPage() {
  const router = useRouter();
  return <SpeedDevShell onExit={() => router.push("/")} />;
}
