"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { VideoProjectStatusV2, ProcessingStep, JobStatusResponse } from "@/types/video-pipeline";

const POLLING_INTERVAL_MS = 3000;

const PROCESSING_STATUSES: VideoProjectStatusV2[] = [
  "queued",
  "extracting_audio",
  "transcribing",
  "detecting_cuts",
  "rendering",
];

export interface UseVideoJobReturn {
  status: VideoProjectStatusV2 | "idle";
  step: ProcessingStep | null;
  progress: number; // 0-100
  errorStep: string | null;
  errorMessage: string | null;
  cutsCount: number;
  durationSeconds: number | null;
  costCents: number | null;
  isProcessing: boolean;
  isReady: boolean;
  isFailed: boolean;
  startTracking: (projectId: string) => void;
  stopTracking: () => void;
  retry: () => Promise<void>;
}

export function useVideoJob(): UseVideoJobReturn {
  const [status, setStatus] = useState<VideoProjectStatusV2 | "idle">("idle");
  const [step, setStep] = useState<ProcessingStep | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorStep, setErrorStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cutsCount, setCutsCount] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [costCents, setCostCents] = useState<number | null>(null);

  const projectIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isProcessing = PROCESSING_STATUSES.includes(status as VideoProjectStatusV2);
  const isReady = status === "ready";
  const isFailed = status === "failed";

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/video/job-status/${projectId}`);
      if (!res.ok) return;
      const data = await res.json() as JobStatusResponse;

      setStatus(data.status);
      setStep(data.step);
      setProgress(data.progress);
      setErrorStep(data.error_step ?? null);
      setErrorMessage(data.error_message ?? null);
      setCutsCount(data.cuts_count);
      setDurationSeconds(data.duration_seconds);
      setCostCents(data.cost_estimate_cents);

      // Stop polling when terminal status reached
      if (data.status === "ready" || data.status === "failed") {
        clearPolling();
      }
    } catch {
      // Network error — keep polling, do not change state
    }
  }, [clearPolling]);

  const startTracking = useCallback(
    (projectId: string) => {
      clearPolling();
      projectIdRef.current = projectId;

      // Reset state
      setStatus("queued");
      setStep(null);
      setProgress(0);
      setErrorStep(null);
      setErrorMessage(null);
      setCutsCount(0);
      setDurationSeconds(null);
      setCostCents(null);

      // Immediate first fetch
      void fetchStatus(projectId);

      // Then poll every 3s
      intervalRef.current = setInterval(() => {
        void fetchStatus(projectId);
      }, POLLING_INTERVAL_MS);
    },
    [clearPolling, fetchStatus]
  );

  const stopTracking = useCallback(() => {
    clearPolling();
    projectIdRef.current = null;
  }, [clearPolling]);

  const retry = useCallback(async () => {
    const projectId = projectIdRef.current;
    if (!projectId) return;

    setErrorStep(null);
    setErrorMessage(null);
    setStatus("queued");
    setProgress(0);

    try {
      await fetch("/api/video/start-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
    } catch {
      // ignore — polling will catch the new status
    }

    // Restart polling
    clearPolling();
    void fetchStatus(projectId);
    intervalRef.current = setInterval(() => {
      void fetchStatus(projectId);
    }, POLLING_INTERVAL_MS);
  }, [clearPolling, fetchStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  return {
    status,
    step,
    progress,
    errorStep,
    errorMessage,
    cutsCount,
    durationSeconds,
    costCents,
    isProcessing,
    isReady,
    isFailed,
    startTracking,
    stopTracking,
    retry,
  };
}
