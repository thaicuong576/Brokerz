'use client';

import { AuthView } from "@/components/AuthView";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleAuthSuccess = () => {
    router.push('/');
  };

  return <AuthView onAuthSuccess={handleAuthSuccess} />;
}
