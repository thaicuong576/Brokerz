"use client";

import { ProfileHub } from "@/components/ProfileHub";
import { useUser } from "@/context/UserContext";

export default function ProfilePage() {
  const { user, isBroker, profile } = useUser();
  return (
    <ProfileHub 
      isBroker={isBroker} 
      user={user} 
      profile={profile}
    />
  );
}
