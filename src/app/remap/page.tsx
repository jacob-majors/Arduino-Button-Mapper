"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RemapModal from "@/components/RemapModal";

const REMOTE_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.trim() || "";
const LOCAL_BACKEND_URL = "http://localhost:3001";

export default function QuickRemapPage() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = useState(REMOTE_BACKEND_URL || LOCAL_BACKEND_URL);

  useEffect(() => {
    let cancelled = false;
    const method = localStorage.getItem("uploadMethod");
    const chooseBackend = async () => {
      if (method === "local") {
        setBackendUrl(LOCAL_BACKEND_URL);
        return;
      }
      if (method === "web") {
        setBackendUrl(REMOTE_BACKEND_URL && REMOTE_BACKEND_URL !== LOCAL_BACKEND_URL ? REMOTE_BACKEND_URL : LOCAL_BACKEND_URL);
        return;
      }
      try {
        const res = await fetch(`${LOCAL_BACKEND_URL}/api/health`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.ok === true && data?.cliInstalled === true) {
          setBackendUrl(LOCAL_BACKEND_URL);
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) {
        setBackendUrl(REMOTE_BACKEND_URL && REMOTE_BACKEND_URL !== LOCAL_BACKEND_URL ? REMOTE_BACKEND_URL : LOCAL_BACKEND_URL);
      }
    };
    chooseBackend();
    return () => { cancelled = true; };
  }, []);

  return (
    <RemapModal
      backendUrl={backendUrl}
      onClose={() => router.push("/app")}
      pageMode
    />
  );
}
