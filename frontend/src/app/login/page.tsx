'use client';

import { AuthView } from "@/components/AuthView";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleAuthSuccess = (intendedRole: string) => {
    // Persist the login intent so the dashboard can detect broker-pending state
    if (typeof window !== 'undefined') {
      localStorage.setItem('bkz_login_intent', intendedRole);
    }
    router.push('/');
  };

  return <AuthView onAuthSuccess={handleAuthSuccess} />;
}
