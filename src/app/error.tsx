"use client";

import { useEffect } from "react";
import { OctagonAlert } from "lucide-react";
import { StateScreen } from "@/components/app/StateScreen";
import { Button } from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateScreen
      icon={OctagonAlert}
      title="Something went wrong"
      message="An unexpected error occurred. You can try again, and if the problem persists, contact support."
      actions={
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
