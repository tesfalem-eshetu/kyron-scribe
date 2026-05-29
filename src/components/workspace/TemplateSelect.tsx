"use client";

import { TriangleAlert } from "lucide-react";
import type { ProviderTemplate } from "@/lib/client/types";

export function TemplateSelect({
  templates,
  value,
  onChange,
  archived,
  disabled,
}: {
  templates: ProviderTemplate[];
  value: string | null;
  onChange: (id: string) => void;
  archived?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="card panel-body">
      <div className="field">
        <label htmlFor="ws-tpl">Note Template</label>
        <select
          id="ws-tpl"
          className={`select${archived ? " tpl-warn" : ""}`}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select a template…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {archived && (
          <div className="field-error" style={{ color: "var(--amber-600)" }}>
            <TriangleAlert aria-hidden="true" /> This template was archived. Choose
            another.
          </div>
        )}
      </div>
    </div>
  );
}
