"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { apiFetch, isApiError } from "@/lib/client/api";
import type { Icd10Result } from "@/lib/client/types";

type State = "idle" | "loading" | "results" | "empty" | "error";

export function Icd10Widget({
  onPick,
}: {
  onPick: (item: Icd10Result) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<Icd10Result[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setState("idle");
      setResults([]);
      return;
    }
    setState("loading");
    timer.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { results } = await apiFetch<{ results: Icd10Result[] }>(
          `/api/provider/icd10/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        setResults(results);
        setState(results.length ? "results" : "empty");
      } catch (error) {
        if (isApiError(error) && error.code === "NETWORK_ERROR") {
          // aborted or offline; ignore aborts silently
          if (controller.signal.aborted) return;
        }
        setState("error");
      }
    }, 320);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="card">
      <div className="panel-head">
        <h3>Suggested ICD-10 Codes</h3>
      </div>
      <div className="panel-body">
        <div className="icd-search">
          <Search className="lead" aria-hidden="true" />
          <input
            className="input"
            placeholder="Search ICD-10, e.g., high blood sugar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search ICD-10 codes"
          />
        </div>

        {state === "loading" && (
          <div className="icd-state loading">
            <Loader2 className="spin" aria-hidden="true" /> Searching catalog…
          </div>
        )}
        {state === "idle" && (
          <div className="icd-state">
            Search the ICD-10 catalog and click a code to add it to Assessment.
          </div>
        )}
        {state === "empty" && (
          <div className="icd-state">
            No codes match “{q.trim()}”. Try a symptom or condition.
          </div>
        )}
        {state === "error" && (
          <div className="icd-state">Search failed. Try again.</div>
        )}
        {state === "results" && (
          <div className="icd-results">
            {results.map((item) => (
              <button
                key={item.id}
                className="icd-item"
                onClick={() => onPick(item)}
              >
                <span className="code">{item.code}</span>
                <span className="desc">
                  {item.description}
                  {item.category && <div className="cat">{item.category}</div>}
                </span>
                <span className="add" aria-hidden="true">
                  <Plus />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
