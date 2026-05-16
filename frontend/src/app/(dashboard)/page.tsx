"use client";

import { Dashboard } from "@/components/Dashboard";
import { useUser } from "@/context/UserContext";

export default function IntelligencePage() {
  const { isBroker } = useUser();
  return <Dashboard isBroker={isBroker} />;
}
