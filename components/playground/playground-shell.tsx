"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/playground/action-bar";
import type { CodeEditorDiagnostics } from "@/components/playground/code-editor";
import { QuestionsPanel } from "@/components/playground/questions-panel";
import { ResponsePanel } from "@/components/playground/response-panel";
import { StatePanel } from "@/components/playground/state-panel";
import { TopBar } from "@/components/playground/top-bar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { buildCurlCommand } from "@/lib/laya/curl";
import {
  appendHistoryEntry,
  clearHistory as clearStoredHistory,
  loadHistory,
  loadWorkspaceState,
  saveWorkspaceState,
} from "@/lib/laya/storage";
import {
  buildPredictPayload,
  EXAMPLE_PRESETS,
  insertQuestionTemplate,
} from "@/lib/laya/templates";
import type {
  HistoryEntry,
  LayaHealthState,
  LayaSettings,
  PlaygroundWorkspaceState,
  QuestionType,
  RunResult,
  StateMode,
} from "@/lib/laya/types";
import { resolveLayaEndpoints } from "@/lib/laya/url";

const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_STATE_TEXT =
  '{\n  "example_state": "Add context for Laya to evaluate."\n}';

const INITIAL_WORKSPACE: PlaygroundWorkspaceState = {
  apiUrl: DEFAULT_API_URL,
  stateMode: "json",
  stateText: DEFAULT_STATE_TEXT,
  questionsText: "",
  settings: {},
  activePresetId: undefined,
};

interface HealthProxyResponse {
  ok: boolean;
  status: number;
  latencyMs: number;
  data: unknown;
  error?: string;
  resolvedUrl: string;
}

interface PredictProxyResponse {
  ok: boolean;
  status: number;
  latencyMs: number;
  data: unknown;
  rawText?: string;
  resolvedUrl?: string;
}

function generateEntryId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractPredictErrorMessage(
  data: unknown,
  fallbackStatusText: string,
): string {
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === "string" && obj.detail.trim()) {
      return obj.detail;
    }
    if (typeof obj.error === "string" && obj.error.trim()) {
      return obj.error;
    }
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message;
    }
  }
  return fallbackStatusText || "Request failed";
}

export function PlaygroundShell() {
  const [workspace, setWorkspace] =
    useState<PlaygroundWorkspaceState>(INITIAL_WORKSPACE);
  const [isHydrated, setIsHydrated] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [health, setHealth] = useState<LayaHealthState>({ status: "idle" });
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [stateDiagnostics, setStateDiagnostics] =
    useState<CodeEditorDiagnostics>({ errorCount: 0 });
  const [questionsDiagnostics, setQuestionsDiagnostics] =
    useState<CodeEditorDiagnostics>({ errorCount: 0 });

  const healthAbortRef = useRef<AbortController | null>(null);
  const predictAbortRef = useRef<AbortController | null>(null);

  // Hydrate workspace & history from localStorage after mount (SSR-safe)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedWorkspace = loadWorkspaceState();
      if (savedWorkspace) {
        setWorkspace({
          apiUrl:
            typeof savedWorkspace.apiUrl === "string" &&
            savedWorkspace.apiUrl.trim()
              ? savedWorkspace.apiUrl
              : DEFAULT_API_URL,
          stateMode: savedWorkspace.stateMode === "text" ? "text" : "json",
          stateText:
            typeof savedWorkspace.stateText === "string"
              ? savedWorkspace.stateText
              : DEFAULT_STATE_TEXT,
          questionsText:
            typeof savedWorkspace.questionsText === "string"
              ? savedWorkspace.questionsText
              : "",
          settings:
            savedWorkspace.settings && typeof savedWorkspace.settings === "object"
              ? savedWorkspace.settings
              : {},
          activePresetId:
            typeof savedWorkspace.activePresetId === "string"
              ? savedWorkspace.activePresetId
              : undefined,
        });
      }
      setHistory(loadHistory());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Auto-save workspace changes after initial hydration
  useEffect(() => {
    if (!isHydrated) return;
    saveWorkspaceState(workspace);
  }, [isHydrated, workspace]);

  const runHealthCheck = useCallback(async (targetUrl: string) => {
    healthAbortRef.current?.abort();

    try {
      resolveLayaEndpoints(targetUrl);
    } catch (err) {
      setHealth({
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Invalid API URL",
        checkedAt: Date.now(),
      });
      return;
    }

    const controller = new AbortController();
    healthAbortRef.current = controller;
    setHealth((prev) => ({
      ...prev,
      status: "checking",
      error: undefined,
    }));

    try {
      const res = await fetch(
        `/api/laya/health?url=${encodeURIComponent(targetUrl.trim())}`,
        {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        },
      );
      const body = (await res.json()) as HealthProxyResponse;

      if (controller.signal.aborted) return;

      if (body.ok) {
        const healthObj =
          typeof body.data === "object" &&
          body.data !== null &&
          !Array.isArray(body.data)
            ? (body.data as Record<string, unknown>)
            : null;
        const model =
          healthObj && typeof healthObj.model === "string"
            ? healthObj.model
            : undefined;
        const loaded =
          healthObj && typeof healthObj.loaded === "boolean"
            ? healthObj.loaded
            : undefined;

        setHealth({
          status: "healthy",
          model,
          loaded,
          latencyMs: body.latencyMs,
          checkedAt: Date.now(),
        });
      } else {
        setHealth({
          status: "unhealthy",
          latencyMs: body.latencyMs,
          error: body.error || `HTTP ${body.status}`,
          checkedAt: Date.now(),
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setHealth({
        status: "unhealthy",
        error: err instanceof Error ? err.message : "Health check failed",
        checkedAt: Date.now(),
      });
    }
  }, []);

  // Debounced /health check on apiUrl changes after hydration
  useEffect(() => {
    if (!isHydrated) return;

    const timer = window.setTimeout(() => {
      void runHealthCheck(workspace.apiUrl);
    }, 500);

    return () => {
      window.clearTimeout(timer);
      healthAbortRef.current?.abort();
    };
  }, [isHydrated, workspace.apiUrl, runHealthCheck]);

  // Cleanup any in-flight predict request on unmount
  useEffect(() => {
    return () => {
      predictAbortRef.current?.abort();
    };
  }, []);

  const activeModel =
    workspace.settings.model?.trim() || health.model?.trim() || undefined;

  const validation = useMemo(() => {
    try {
      resolveLayaEndpoints(workspace.apiUrl);
    } catch (err) {
      return {
        disabled: true,
        reason: err instanceof Error ? err.message : "Invalid API URL",
      };
    }

    if (workspace.stateMode === "json" && stateDiagnostics.errorCount > 0) {
      return {
        disabled: true,
        reason:
          stateDiagnostics.firstError ||
          "Fix State JSON syntax errors before running",
      };
    }

    if (questionsDiagnostics.errorCount > 0) {
      return {
        disabled: true,
        reason:
          questionsDiagnostics.firstError ||
          "Fix Questions JSON syntax errors before running",
      };
    }

    try {
      buildPredictPayload(
        workspace.stateMode,
        workspace.stateText,
        workspace.questionsText,
        workspace.settings,
      );
      return { disabled: false, reason: undefined };
    } catch (err) {
      return {
        disabled: true,
        reason:
          err instanceof Error ? err.message : "Complete request inputs to run",
      };
    }
  }, [
    workspace.apiUrl,
    workspace.stateMode,
    workspace.stateText,
    workspace.questionsText,
    workspace.settings,
    stateDiagnostics,
    questionsDiagnostics,
  ]);

  const handleRun = useCallback(async () => {
    if (predictAbortRef.current) return;

    let predictUrl: string;
    let payload: Record<string, unknown>;
    try {
      predictUrl = resolveLayaEndpoints(workspace.apiUrl).predictUrl;
      payload = buildPredictPayload(
        workspace.stateMode,
        workspace.stateText,
        workspace.questionsText,
        workspace.settings,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid request inputs",
      );
      return;
    }

    const controller = new AbortController();
    predictAbortRef.current = controller;
    setIsRunning(true);

    const startedAt = performance.now();
    try {
      const response = await fetch("/api/laya/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUrl: workspace.apiUrl,
          payload,
        }),
        signal: controller.signal,
      });

      const body = (await response.json()) as PredictProxyResponse;
      if (controller.signal.aborted) return;

      const status =
        typeof body.status === "number" ? body.status : response.status;
      const latencyMs =
        typeof body.latencyMs === "number"
          ? body.latencyMs
          : Math.round(performance.now() - startedAt);
      const ok = Boolean(body.ok);

      const runResult: RunResult = {
        ok,
        status,
        latencyMs,
        timestamp: Date.now(),
        rawData: body.data,
        rawText: typeof body.rawText === "string" ? body.rawText : undefined,
        errorMessage: ok
          ? undefined
          : extractPredictErrorMessage(body.data, response.statusText),
        sentQuestions: payload.questions,
        targetUrl: body.resolvedUrl || predictUrl,
      };

      setResult(runResult);

      const preset = EXAMPLE_PRESETS.find(
        (p) => p.id === workspace.activePresetId,
      );
      const historyEntry: HistoryEntry = {
        id: generateEntryId(),
        timestamp: runResult.timestamp,
        label: preset ? preset.name : "Custom request",
        apiUrl: workspace.apiUrl,
        stateMode: workspace.stateMode,
        stateText: workspace.stateText,
        questionsText: workspace.questionsText,
        settings: { ...workspace.settings },
        result: runResult,
      };
      setHistory(appendHistoryEntry(historyEntry));
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        return;
      }

      const latencyMs = Math.round(performance.now() - startedAt);
      const message =
        err instanceof Error ? err.message : "Failed to execute request";

      setResult({
        ok: false,
        status: 0,
        latencyMs,
        timestamp: Date.now(),
        rawData: { detail: message },
        errorMessage: message,
        sentQuestions: payload.questions,
        targetUrl: predictUrl,
      });
    } finally {
      if (predictAbortRef.current === controller) {
        predictAbortRef.current = null;
      }
      setIsRunning(false);
    }
  }, [workspace]);

  const handleCancel = useCallback(() => {
    if (predictAbortRef.current) {
      predictAbortRef.current.abort();
      predictAbortRef.current = null;
      setIsRunning(false);
      toast.info("Request cancelled");
    }
  }, []);

  // Global Ctrl+Enter / Cmd+Enter shortcut
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!validation.disabled && !predictAbortRef.current) {
          void handleRun();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRun, validation.disabled]);

  const handleSelectPreset = useCallback((presetId: string | null) => {
    if (presetId === null) {
      setWorkspace((prev) => ({
        ...prev,
        stateMode: "json",
        stateText: DEFAULT_STATE_TEXT,
        questionsText: "",
        settings: {},
        activePresetId: "blank",
      }));
      setResult(null);
      setStateDiagnostics({ errorCount: 0 });
      setQuestionsDiagnostics({ errorCount: 0 });
      toast.success("Reset to blank template");
      return;
    }

    const preset = EXAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setWorkspace((prev) => ({
      ...prev,
      stateMode: preset.stateMode,
      stateText: preset.stateText,
      questionsText: preset.questionsText,
      settings: { ...preset.settings },
      activePresetId: preset.id,
    }));
    setResult(null);
    setStateDiagnostics({ errorCount: 0 });
    setQuestionsDiagnostics({ errorCount: 0 });
    toast.success(`Loaded preset: ${preset.name}`);
  }, []);

  const handleClear = useCallback(() => {
    setWorkspace((prev) => ({
      ...prev,
      stateMode: "json",
      stateText: DEFAULT_STATE_TEXT,
      questionsText: "",
      activePresetId: undefined,
    }));
    setResult(null);
    setStateDiagnostics({ errorCount: 0 });
    setQuestionsDiagnostics({ errorCount: 0 });
  }, []);

  const handleCopyCurl = useCallback(async () => {
    try {
      const { predictUrl } = resolveLayaEndpoints(workspace.apiUrl);
      const payload = buildPredictPayload(
        workspace.stateMode,
        workspace.stateText,
        workspace.questionsText,
        workspace.settings,
      );
      const command = buildCurlCommand(predictUrl, payload);
      await navigator.clipboard.writeText(command);
      toast.success("cURL command copied to clipboard");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Cannot generate cURL from current inputs",
      );
    }
  }, [workspace]);

  const handleAddQuestion = useCallback(
    (type: QuestionType) => {
      try {
        const nextQuestions = insertQuestionTemplate(
          workspace.questionsText,
          type,
        );
        setWorkspace((prev) => ({
          ...prev,
          questionsText: nextQuestions,
        }));
        setQuestionsDiagnostics({ errorCount: 0 });
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Cannot insert question template",
        );
      }
    },
    [workspace.questionsText],
  );

  const handleSelectHistoryEntry = useCallback((entry: HistoryEntry) => {
    setWorkspace({
      apiUrl: entry.apiUrl,
      stateMode: entry.stateMode,
      stateText: entry.stateText,
      questionsText: entry.questionsText,
      settings: { ...entry.settings },
      activePresetId: undefined,
    });
    setResult(entry.result);
    setStateDiagnostics({ errorCount: 0 });
    setQuestionsDiagnostics({ errorCount: 0 });
    toast.success("Restored request from history");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearStoredHistory();
    setHistory([]);
    toast.success("Cleared request history");
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      <TopBar
        apiUrl={workspace.apiUrl}
        onApiUrlChange={(apiUrl) =>
          setWorkspace((prev) => ({ ...prev, apiUrl }))
        }
        health={health}
        onCheckHealth={() => void runHealthCheck(workspace.apiUrl)}
        activePresetId={workspace.activePresetId}
        onSelectPreset={handleSelectPreset}
        history={history}
        onSelectHistoryEntry={handleSelectHistoryEntry}
        onClearHistory={handleClearHistory}
        onCopyCurl={() => void handleCopyCurl()}
        onClear={handleClear}
        settings={workspace.settings}
        onSettingsChange={(settings: LayaSettings) =>
          setWorkspace((prev) => ({ ...prev, settings }))
        }
        onResetSettings={() =>
          setWorkspace((prev) => ({ ...prev, settings: {} }))
        }
      />

      <main className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full w-full"
        >
          {/* Left Pane: State (top) + Questions (bottom) + ActionBar */}
          <ResizablePanel
            defaultSize="50%"
            minSize="25%"
            className="flex min-h-0 min-w-0 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <ResizablePanelGroup
                orientation="vertical"
                className="h-full w-full"
              >
                <ResizablePanel
                  defaultSize="50%"
                  minSize="20%"
                  className="min-h-0 overflow-hidden"
                >
                  <StatePanel
                    value={workspace.stateText}
                    onChange={(stateText) =>
                      setWorkspace((prev) => ({ ...prev, stateText }))
                    }
                    mode={workspace.stateMode}
                    onModeChange={(stateMode: StateMode) =>
                      setWorkspace((prev) => ({ ...prev, stateMode }))
                    }
                    diagnostics={stateDiagnostics}
                    onDiagnosticsChange={setStateDiagnostics}
                    onRunShortcut={() => void handleRun()}
                  />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel
                  defaultSize="50%"
                  minSize="20%"
                  className="min-h-0 overflow-hidden"
                >
                  <QuestionsPanel
                    value={workspace.questionsText}
                    onChange={(questionsText) =>
                      setWorkspace((prev) => ({ ...prev, questionsText }))
                    }
                    diagnostics={questionsDiagnostics}
                    onDiagnosticsChange={setQuestionsDiagnostics}
                    onRunShortcut={() => void handleRun()}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>

            <ActionBar
              onAddQuestion={handleAddQuestion}
              activeModel={activeModel}
              isRunning={isRunning}
              disabled={validation.disabled}
              disabledReason={validation.reason}
              onRun={() => void handleRun()}
              onCancel={handleCancel}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Pane: ResponsePanel */}
          <ResizablePanel
            defaultSize="50%"
            minSize="25%"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <ResponsePanel
              result={result}
              isRunning={isRunning}
              modelFallback={activeModel}
              onSelectPreset={(presetId) => handleSelectPreset(presetId)}
              onCancel={handleCancel}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
