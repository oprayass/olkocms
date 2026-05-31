"use client";
import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

// session मा expired flag देखे auto-logout
export default function SessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if ((session as any)?.expired) {
      signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  return null;
}