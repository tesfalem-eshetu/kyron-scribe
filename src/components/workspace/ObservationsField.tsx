"use client";

export function ObservationsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="card">
      <div className="panel-head">
        <h3>Clinical Observations</h3>
        <span className="char-meta">{value.length} chars</span>
      </div>
      <div className="panel-body">
        <textarea
          className="textarea obs-area"
          value={value}
          placeholder="Type, paste, or dictate the raw visit transcript…"
          onChange={(e) => onChange(e.target.value)}
          aria-label="Clinical observations transcript"
        />
      </div>
    </div>
  );
}
