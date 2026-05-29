"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { AdminTemplate } from "@/lib/client/types";

export function TemplateEditorDrawer({
  template,
  onClose,
  onSaved,
}: {
  // null => create mode
  template: AdminTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = template !== null;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [promptText, setPromptText] = useState(template?.promptText ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = "Required.";
    if (!promptText.trim()) fe.promptText = "Required.";
    setErrors(fe);
    if (Object.keys(fe).length) return;

    setSaving(true);
    try {
      if (isEdit && template) {
        await apiFetch(`/api/admin/templates/${template.id}`, {
          method: "PATCH",
          body: {
            name: name.trim(),
            description: description.trim() || null,
            promptText: promptText.trim(),
          },
        });
      } else {
        await apiFetch("/api/admin/templates", {
          method: "POST",
          body: {
            name: name.trim(),
            description: description.trim() || null,
            promptText: promptText.trim(),
          },
        });
      }
      onSaved();
      onClose();
    } catch (error) {
      setSaving(false);
      setErrors({
        promptText: isApiError(error) ? error.message : "Could not save template.",
      });
    }
  }

  return (
    <Drawer
      title={isEdit ? "Edit template" : "New template"}
      ariaLabel={isEdit ? "Edit template" : "New template"}
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </>
      }
    >
      <div className="editor-note">
        <Info aria-hidden="true" />
        <span>Changes apply to the next note generated with this template.</span>
      </div>

      <TextField
        label="Name"
        autoFocus
        placeholder="e.g. General SOAP"
        value={name}
        disabled={saving}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          if (errors.name) setErrors((s) => ({ ...s, name: "" }));
        }}
      />
      <div style={{ marginTop: 16 }}>
        <TextField
          label="Description"
          optional
          placeholder="Short summary shown to providers"
          value={description}
          disabled={saving}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <TextAreaField
          label="Prompt text"
          rows={14}
          textareaClassName="mono"
          placeholder="Instructions sent to the model to structure the SOAP note…"
          value={promptText}
          disabled={saving}
          error={errors.promptText}
          onChange={(e) => {
            setPromptText(e.target.value);
            if (errors.promptText) setErrors((s) => ({ ...s, promptText: "" }));
          }}
        />
      </div>
    </Drawer>
  );
}
