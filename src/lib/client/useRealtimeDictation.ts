"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Live dictation uses OpenAI Realtime transcription over WebRTC. The browser
// mints a short-lived ephemeral token from our server, opens a peer connection
// streaming microphone audio, and reads transcript events off a data channel.
// A recorded-audio path (MediaRecorder -> server file transcription) is the
// fallback when WebRTC is blocked by the browser, network, or permissions.

export type DictationStatus =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "recording"
  | "transcribing"
  | "stopping"
  | "review"
  | "error";

export type DictationMode = "realtime" | "fallback";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const MAX_DURATION_MS = 180_000;

export interface UseRealtimeDictation {
  status: DictationStatus;
  mode: DictationMode | null;
  liveText: string;
  reviewText: string;
  elapsedMs: number;
  remainingMs: number;
  error: string | null;
  active: boolean;
  startRealtime: () => Promise<void>;
  startFallback: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied. Allow microphone permission and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found. Connect a microphone and try again.";
  }
  return "Could not start the microphone. Please try again.";
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useRealtimeDictation(): UseRealtimeDictation {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [mode, setMode] = useState<DictationMode | null>(null);
  const [liveText, setLiveText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const committedRef = useRef("");
  const partialRef = useRef("");
  const mountedRef = useRef(true);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const teardownConnection = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      dcRef.current?.close();
    } catch {
      /* ignore */
    }
    dcRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    stopTracks();
  }, [stopTracks]);

  const composedLive = useCallback(() => {
    const committed = committedRef.current;
    const partial = partialRef.current;
    if (!partial) return committed;
    return committed ? `${committed} ${partial}` : partial;
  }, []);

  const reset = useCallback(() => {
    teardownConnection();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    committedRef.current = "";
    partialRef.current = "";
    setLiveText("");
    setReviewText("");
    setElapsedMs(0);
    setError(null);
    setMode(null);
    setStatus("idle");
  }, [teardownConnection]);

  // Stop the currently active capture. Realtime tears down the peer connection
  // immediately; fallback stops the recorder, whose onstop handler uploads.
  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mode === "fallback") {
      setStatus("stopping");
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      return;
    }
    teardownConnection();
    const finalText = composedLive().trim();
    setReviewText(finalText);
    setStatus("review");
  }, [mode, teardownConnection, composedLive]);

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_DURATION_MS) stop();
    }, 250);
  }, [stop]);

  const startRealtime = useCallback(async () => {
    if (
      typeof RTCPeerConnection === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMode("realtime");
      setError(
        "Live dictation is unavailable in this browser. Use recorded dictation or type manually.",
      );
      setStatus("error");
      return;
    }

    setMode("realtime");
    setError(null);
    committedRef.current = "";
    partialRef.current = "";
    setLiveText("");
    setReviewText("");

    let stream: MediaStream;
    try {
      setStatus("requesting-mic");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      setError(micErrorMessage(err));
      setStatus("error");
      return;
    }

    try {
      setStatus("connecting");

      const sessionRes = await fetch(
        "/api/provider/dictation/realtime-session",
        { method: "POST", credentials: "same-origin" },
      );
      if (!sessionRes.ok) {
        throw new Error(`session ${sessionRes.status}`);
      }
      const { token } = (await sessionRes.json()) as { token: string };

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (
          (state === "failed" || state === "disconnected") &&
          mountedRef.current &&
          status !== "review"
        ) {
          teardownConnection();
          setError(
            "The dictation connection dropped. Use recorded dictation or type manually.",
          );
          setStatus("error");
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (event) => {
        let msg: { type?: string; delta?: string; transcript?: string };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (msg.type === "conversation.item.input_audio_transcription.delta") {
          partialRef.current += msg.delta ?? "";
          setLiveText(composedLive());
        } else if (
          msg.type === "conversation.item.input_audio_transcription.completed"
        ) {
          const finalSegment = (msg.transcript ?? "").trim();
          if (finalSegment) {
            committedRef.current = committedRef.current
              ? `${committedRef.current} ${finalSegment}`
              : finalSegment;
          }
          partialRef.current = "";
          setLiveText(composedLive());
        }
      };

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Model + transcription config are bound to the ephemeral token, so the
      // model is not passed here. The beta /v1/realtime?model= SDP shape was
      // deprecated 2026-05-12; the GA endpoint is /v1/realtime/calls.
      const sdpRes = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!sdpRes.ok) {
        throw new Error(`sdp ${sdpRes.status}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      if (!mountedRef.current) {
        teardownConnection();
        return;
      }
      setStatus("recording");
      startTimer();
    } catch {
      teardownConnection();
      setError(
        "Live dictation is unavailable right now. Use recorded dictation or type manually.",
      );
      setStatus("error");
    }
  }, [composedLive, startTimer, teardownConnection, status]);

  const uploadFallback = useCallback(async (blob: Blob) => {
    try {
      setStatus("transcribing");
      const ext = blob.type.includes("mp4")
        ? "mp4"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const form = new FormData();
      form.append("audio", blob, `dictation.${ext}`);

      const res = await fetch("/api/provider/dictation/transcribe", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error(`transcribe ${res.status}`);
      }
      const { text } = (await res.json()) as { text: string };
      if (!mountedRef.current) return;
      setReviewText(text.trim());
      setStatus("review");
    } catch {
      if (!mountedRef.current) return;
      setError("Transcription failed. Your typed draft is still saved. Please try again.");
      setStatus("error");
    }
  }, []);

  const startFallback = useCallback(async () => {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMode("fallback");
      setError(
        "Recorded dictation is unavailable in this browser. Please type manually.",
      );
      setStatus("error");
      return;
    }

    setMode("fallback");
    setError(null);
    setLiveText("");
    setReviewText("");
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      setStatus("requesting-mic");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      setError(micErrorMessage(err));
      setStatus("error");
      return;
    }

    try {
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size === 0) {
          setError("No audio was captured. Please try again.");
          setStatus("error");
          return;
        }
        void uploadFallback(blob);
      };
      recorder.start();
      setStatus("recording");
      startTimer();
    } catch {
      stopTracks();
      setError("Could not start recording. Please type manually.");
      setStatus("error");
    }
  }, [startTimer, stopTracks, uploadFallback]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        dcRef.current?.close();
        pcRef.current?.close();
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const active =
    status === "requesting-mic" ||
    status === "connecting" ||
    status === "recording" ||
    status === "transcribing" ||
    status === "stopping";

  return {
    status,
    mode,
    liveText,
    reviewText,
    elapsedMs,
    remainingMs: Math.max(0, MAX_DURATION_MS - elapsedMs),
    error,
    active,
    startRealtime,
    startFallback,
    stop,
    reset,
  };
}
