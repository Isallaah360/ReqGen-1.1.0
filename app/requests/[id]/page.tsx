"use client";

import { useParams } from "next/navigation";
import RequestDetailsWorkspace from "@/app/components/requests/RequestDetailsWorkspace";
import RequestAccessGate from "@/app/components/requests/RequestAccessGate";

export default function RequestDetailsPage() {
  const params = useParams<{ id: string }>();
  return (
    <RequestAccessGate requestId={params?.id}>
      <RequestDetailsWorkspace />
    </RequestAccessGate>
  );
}
