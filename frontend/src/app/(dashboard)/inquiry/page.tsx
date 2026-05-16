"use client";

import { InquiryHub } from "@/components/InquiryHub";
import { useUser } from "@/context/UserContext";

export default function InquiryPage() {
  const { user, isBroker, profile } = useUser();
  return (
    <InquiryHub 
      user={user} 
      isBroker={isBroker}
      profile={profile}
    />
  );
}
