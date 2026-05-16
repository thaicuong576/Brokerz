"use client";

import { PortfolioView } from "@/components/PortfolioView";
import { useUser } from "@/context/UserContext";

export default function PortfolioPage() {
  const { user, isBroker, profile } = useUser();
  return (
    <PortfolioView 
      isBroker={isBroker} 
      user={user} 
      profile={profile}
    />
  );
}
