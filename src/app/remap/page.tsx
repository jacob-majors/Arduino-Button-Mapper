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
    const method = localStorage.getItem("uploadMethod");
    if (method === "local") {
      setBackendUrl(LOCAL_BACKEND_URL);
    } else if (REMOTE_BACKEND_URL && REMOTE_BACKEND_URL !== LOCAL_BACKEND_URL) {
      setBackendUrl(REMOTE_BACKEND_URL);
    } else {
      setBackendUrl(LOCAL_BACKEND_URL);
    }
  }, []);

  return (
    <RemapModal
      backendUrl={backendUrl}
      onClose={() => router.push("/app")}
      pageMode
    />
  );
}
