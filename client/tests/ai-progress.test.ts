import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAIRunProgress } from "../src/pages/AICoach/hooks/useAIRunProgress";
import { aiService } from "@/services/aiService";
import { AIRunStatus } from "@/types";

vi.mock("@/services/aiService", () => ({ aiService: {
  getRunSnapshot: vi.fn(), runEventsUrl: vi.fn(() => "/events"),
} }));
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onerror: (() => void) | null = null;
  close = vi.fn();
  listener: ((event: { data: string }) => void) | null = null;
  constructor() { FakeEventSource.instances.push(this); }
  addEventListener(_type: string, listener: (event: { data: string }) => void) {
    this.listener = listener;
  }
}
const snapshot = (status = AIRunStatus.Running, events: unknown[] = []) =>
  ({ data: { success: true, data: { status, events } } });

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.mocked(aiService.getRunSnapshot).mockResolvedValue(snapshot() as never);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("recovers a terminal run when SSE stays open but silent", async () => {
  const onTerminal = vi.fn();
  renderHook(() => useAIRunProgress({ runId: 1, onTerminal }));
  await act(async () => {});
  expect(FakeEventSource.instances).toHaveLength(1);
  vi.mocked(aiService.getRunSnapshot).mockResolvedValue(snapshot(AIRunStatus.Completed) as never);
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  expect(onTerminal).toHaveBeenCalledTimes(1);
  expect(FakeEventSource.instances[0].close).toHaveBeenCalledTimes(1);
});

it("ignores a terminal snapshot from a run that was switched away from", async () => {
  let resolve!: (response: unknown) => void;
  const pending = new Promise((yes) => { resolve = yes; });
  vi.mocked(aiService.getRunSnapshot).mockReturnValueOnce(pending as never);
  const onTerminal = vi.fn();
  const { rerender, result } = renderHook(({ runId }) => useAIRunProgress({ runId, onTerminal }),
    { initialProps: { runId: 1 } });
  rerender({ runId: 2 });
  await act(async () => {
    resolve(snapshot(AIRunStatus.Completed, [{ id: 100, code: "run_completed" }]));
  });
  expect(onTerminal).not.toHaveBeenCalled();
  expect(result.current.events).toEqual([]);
});

it("does not overlap slow polling requests", async () => {
  renderHook(() => useAIRunProgress({ runId: 1, onTerminal: vi.fn() }));
  await act(async () => {});
  vi.mocked(aiService.getRunSnapshot).mockReturnValue(new Promise(() => {}));
  FakeEventSource.instances[0].onerror?.();
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
  expect(aiService.getRunSnapshot).toHaveBeenCalledTimes(2);
});

it("deduplicates a repeated terminal event", async () => {
  const onTerminal = vi.fn();
  renderHook(() => useAIRunProgress({ runId: 1, onTerminal }));
  await act(async () => {});
  const event = { data: JSON.stringify({ id: 10, code: "run_completed" }) };
  act(() => {
    FakeEventSource.instances[0].listener?.(event);
    FakeEventSource.instances[0].listener?.(event);
  });
  expect(onTerminal).toHaveBeenCalledTimes(1);
});
