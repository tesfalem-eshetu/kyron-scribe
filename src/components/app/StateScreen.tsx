import type { LucideIcon } from "lucide-react";

// Full-page centered message used for 404 / error / inactive states.
export function StateScreen({
  icon: Icon,
  title,
  message,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="center-stage">
      <div className="center-col">
        <div className="card empty" role="alert">
          <div className="state-ring">
            <Icon aria-hidden="true" />
          </div>
          <h3>{title}</h3>
          <p>{message}</p>
          {actions && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
