import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { StateScreen } from "@/components/app/StateScreen";

export default function NotFound() {
  return (
    <StateScreen
      icon={FileQuestion}
      title="Page not found"
      message="The page you're looking for doesn't exist or may have been moved."
      actions={
        <Link href="/" className="btn btn-primary btn-sm">
          Back to home
        </Link>
      }
    />
  );
}
