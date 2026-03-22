"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// This page is a thin redirect: /share/<id> → /app?share=<id>
// The app page reads ?share= on mount and loads the config from Supabase.
export default function ShareRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  useEffect(() => {
    if (id) router.replace(`/app?share=${id}`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading shared setup…</p>
      </div>
    </div>
  );
}
