"use client";

import React, { useEffect, useState } from "react";
import { checkBackendHealth } from "@/services/healthService";
import { Badge } from "@/components/ui/Badge";

export function BackendHealthBadge() {
  const [status, setStatus] = useState<"checking" | "ok" | "unreachable">(
    "checking"
  );

  useEffect(() => {
    const controller = new AbortController();
    checkBackendHealth(controller.signal).then((res) => {
      setStatus(res.status === "ok" ? "ok" : "unreachable");
    });
    return () => controller.abort();
  }, []);

  if (status === "checking") {
    return (
      <Badge variant="neutral" dot>
        Checking API...
      </Badge>
    );
  }

  if (status === "ok") {
    return (
      <Badge variant="success" dot>
        API Connected
      </Badge>
    );
  }

  return (
    <Badge variant="warning" dot>
      API Standby (Backend Offline)
    </Badge>
  );
}
