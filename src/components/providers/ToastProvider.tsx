"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  CircleCheck,
  Info,
  OctagonAlert,
  TriangleAlert,
  X,
} from "lucide-react";

type ToastType = "info" | "success" | "error" | "warning";

interface ToastInput {
  type?: ToastType;
  message: string;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  info: Info,
  success: CircleCheck,
  error: OctagonAlert,
  warning: TriangleAlert,
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((ts) => [...ts, { id, type: "info", ...toast }]);
      timers.current[id] = setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const RenderIcon = ICONS[t.type ?? "info"];
          return (
            <div
              key={t.id}
              className={`toast toast-${t.type ?? "info"}`}
              role={t.type === "error" ? "alert" : "status"}
            >
              <RenderIcon aria-hidden="true" />
              <div className="toast-body">{t.message}</div>
              <button
                className="toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
