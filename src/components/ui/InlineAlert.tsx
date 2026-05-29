import { Info, OctagonAlert, TriangleAlert, UserRoundCheck } from "lucide-react";

type AlertType = "info" | "warning" | "error";

const ICONS = {
  info: Info,
  warning: TriangleAlert,
  error: OctagonAlert,
} as const;

interface InlineAlertProps {
  type?: AlertType;
  title?: string;
  children?: React.ReactNode;
  icon?: "info" | "warning" | "error" | "returning";
  className?: string;
}

export function InlineAlert({
  type = "info",
  title,
  children,
  icon,
  className,
}: InlineAlertProps) {
  const Icon = icon === "returning" ? UserRoundCheck : ICONS[icon ?? type];
  return (
    <div
      className={`alert alert-${type} ${className ?? ""}`.trim()}
      role={type === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <div>
        {title && <span className="alert-title">{title} </span>}
        {children}
      </div>
    </div>
  );
}
