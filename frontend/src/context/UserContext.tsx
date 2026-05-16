"use client";

import { createContext, useContext } from "react";

interface UserContextType {
  user: any;
  profile: any;
  workspace?: any;
  isBroker: boolean;
}

export const UserContext = createContext<UserContextType | null>(null);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
