"use client";

import { useCallback, useRef, useState } from "react";
import { ClientApiError, type ApiErrorCode } from "@/lib/client/api";
import type { ExtractedProblem, Icd10Candidate } from "@/lib/client/types";

export interface GenerationMetadata {
  problems: ExtractedProblem[];
  icd10Candidates: Icd10Candidate[];
}

interface StreamArgs {
  encounterId: string;
  transcript?: string;
  templateId?: string;
  onMetadata?: (meta: GenerationMetadata) => void;
  onText?: (fullText: string) => void;
  onDone?: (refused: boolean, fullText: string) => void;
  onError?: (error: ClientApiError) => void;
}

// Streams SOAP generation over SSE. Uses fetch (POST) + a manual SSE parser
// since EventSource cannot issue POST requests.
export function useGenerateStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(async (args: StreamArgs) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    let fullText = "";

    try {
      const res = await fetch(
        `/api/provider/encounters/${args.encounterId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: args.transcript,
            templateId: args.templateId,
          }),
          signal: controller.signal,
          credentials: "same-origin",
        },
      );

      // Pre-stream failures (422 insufficient, 409 template, 400 validation,
      // 404 not found) return JSON, not a stream.
      if (!res.ok || !res.body) {
        const text = await res.text();
        let code: ApiErrorCode = "INTERNAL_ERROR";
        let message = "Generation failed.";
        try {
          const body = JSON.parse(text) as { error?: string; message?: string };
          code = (body.error as ApiErrorCode) ?? code;
          message = body.message ?? message;
        } catch {
          /* keep defaults */
        }
        throw new ClientApiError(code, message, res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;

          if (event === "metadata") {
            args.onMetadata?.(JSON.parse(data) as GenerationMetadata);
          } else if (event === "token") {
            fullText += JSON.parse(data) as string;
            args.onText?.(fullText);
          } else if (event === "done") {
            const parsed = JSON.parse(data) as { refused?: boolean };
            args.onDone?.(Boolean(parsed.refused), fullText);
          } else if (event === "error") {
            const parsed = JSON.parse(data) as { message?: string };
            throw new ClientApiError(
              "INTERNAL_ERROR",
              parsed.message ?? "Generation failed.",
              500,
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const apiError =
        error instanceof ClientApiError
          ? error
          : new ClientApiError(
              "NETWORK_ERROR",
              "Lost connection during generation.",
              0,
            );
      args.onError?.(apiError);
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  return { start, cancel, isStreaming };
}
