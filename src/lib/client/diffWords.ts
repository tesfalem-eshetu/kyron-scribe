export type DiffType = "same" | "added" | "removed";

export interface DiffPart {
  type: DiffType;
  value: string;
}

// Split into word and whitespace tokens so the diff aligns on words while
// preserving the original spacing when we stitch the parts back together.
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

// Word-level diff via longest-common-subsequence. Returns an ordered list of
// parts where `removed` was only in the old text and `added` was only in the
// new text. Adjacent parts of the same type are merged for clean rendering.
//
// A guard falls back to a whole-block replace for pathologically large inputs
// so the O(n*m) table never blows up memory on a clinician's machine.
export function diffWords(oldText: string, newText: string): DiffPart[] {
  if (oldText === newText) {
    return oldText ? [{ type: "same", value: oldText }] : [];
  }

  const a = tokenize(oldText);
  const b = tokenize(newText);
  const n = a.length;
  const m = b.length;

  const parts: DiffPart[] = [];
  const push = (type: DiffType, value: string) => {
    if (!value) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.value += value;
    else parts.push({ type, value });
  };

  if (n * m > 4_000_000) {
    push("removed", oldText);
    push("added", newText);
    return parts;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", a[i]);
      i++;
    } else {
      push("added", b[j]);
      j++;
    }
  }
  while (i < n) push("removed", a[i++]);
  while (j < m) push("added", b[j++]);

  return parts;
}

export function hasChanges(parts: DiffPart[]): boolean {
  return parts.some((p) => p.type !== "same");
}
