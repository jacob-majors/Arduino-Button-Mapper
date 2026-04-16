"use client";

import { useRouter } from "next/navigation";
import RemapModal from "@/components/RemapModal";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function QuickRemapPage() {
  const router = useRouter();

  return (
    <RemapModal
      backendUrl={BACKEND_URL}
      onClose={() => router.push("/app")}
      pageMode
    />
  );
}
