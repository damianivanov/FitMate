import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAICoachPage } from "../src/pages/AICoach/hooks/useAICoachPage";
import { ChatComposer } from "../src/pages/AICoach/components/ChatComposer";
import { aiService } from "@/services/aiService";

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/services/aiService", () => ({ aiService: {
  listConversations: vi.fn(), getConversation: vi.fn(), createConversation: vi.fn(),
  startMessage: vi.fn(), confirmAction: vi.fn(), rejectAction: vi.fn(),
} }));
vi.mock("@/services/workoutService", () => ({ workoutService: {
  getActive: vi.fn(async () => ({ data: { success: true, data: null } })),
} }));
vi.mock("../src/pages/AICoach/hooks/useAIRunProgress", () => ({
  useAIRunProgress: () => ({ events: [], currentCode: "run_queued" }),
}));

const conversation = (id = 1) => ({ id, messages: [], actions: [] });
const response = (data: unknown) => ({ data: { success: true, data } });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.mocked(aiService.listConversations).mockResolvedValue(response([]) as never);
  vi.mocked(aiService.createConversation).mockResolvedValue(response(conversation()) as never);
  vi.mocked(aiService.getConversation).mockImplementation(async (id) => response(conversation(id)) as never);
});
afterEach(cleanup);

async function coach() {
  const hook = renderHook(() => useAICoachPage());
  await waitFor(() => expect(hook.result.current.state.isLoading).toBe(false));
  return hook;
}

describe("coach submissions", () => {
  it("accepts only one send while the first request is pending", async () => {
    const pending = deferred();
    vi.mocked(aiService.startMessage).mockReturnValue(pending.promise as never);
    const { result } = await coach();
    let sending!: Promise<boolean>;
    act(() => {
      sending = result.current.actions.send("hello");
      void result.current.actions.send("hello");
    });
    await waitFor(() => expect(aiService.startMessage).toHaveBeenCalledTimes(1));
    expect(aiService.createConversation).toHaveBeenCalledTimes(1);
    expect(result.current.state.isSending).toBe(true);
    await act(async () => {
      pending.resolve(response({ runId: 10, userMessage: { id: 20, content: "hello" } }));
      await sending;
    });
    expect(result.current.state.activeConversation?.messages).toHaveLength(1);
  });

  it("reuses the request id and conversation after losing the acceptance response", async () => {
    vi.mocked(aiService.startMessage).mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(response({ runId: 10, userMessage: { id: 20, content: "hello" } }) as never);
    const { result } = await coach();
    await act(async () => { expect(await result.current.actions.send("hello")).toBe(false); });
    await act(async () => { expect(await result.current.actions.send("hello")).toBe(true); });
    expect(aiService.startMessage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(aiService.startMessage).mock.calls[0]).toEqual(vi.mocked(aiService.startMessage).mock.calls[1]);
    expect(aiService.createConversation).toHaveBeenCalledTimes(1);
  });

  it("does not reopen an older conversation whose load finishes last", async () => {
    const slow = deferred();
    vi.mocked(aiService.getConversation).mockImplementation(async (id) =>
      id === 1 ? slow.promise : response(conversation(id)) as never);
    const { result } = await coach();
    let opening!: Promise<void>;
    act(() => { opening = result.current.actions.openConversation(1); });
    await act(async () => { await result.current.actions.openConversation(2); });
    await act(async () => { slow.resolve(response(conversation(1))); await opening; });
    expect(result.current.state.activeConversation?.id).toBe(2);
  });

  it("does not replace a new chat with a late send response", async () => {
    const pending = deferred();
    vi.mocked(aiService.startMessage).mockReturnValue(pending.promise as never);
    const { result } = await coach();
    let sending!: Promise<boolean>;
    act(() => { sending = result.current.actions.send("hello"); });
    await waitFor(() => expect(aiService.startMessage).toHaveBeenCalledTimes(1));
    act(() => result.current.actions.startConversation());
    await act(async () => {
      pending.resolve(response({ runId: 10, userMessage: { id: 20, content: "hello" } }));
      await sending;
    });
    expect(result.current.state.activeConversation).toBeNull();
    expect(result.current.state.isSending).toBe(false);
  });

  it("blocks a second action while confirmation is in flight", async () => {
    const pending = deferred();
    vi.mocked(aiService.confirmAction).mockReturnValue(pending.promise as never);
    const { result } = await coach();
    let confirming!: Promise<void>;
    act(() => {
      confirming = result.current.actions.confirmAction(1);
      void result.current.actions.confirmAction(1);
    });
    expect(aiService.confirmAction).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(response({ id: 1 })); await confirming; });
  });
});

it("keeps the draft when sending fails", async () => {
  render(<ChatComposer isSending={false} onSend={async () => false} />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Keep this message" } });
  fireEvent.click(screen.getByRole("button"));
  await act(async () => {});
  expect((input as HTMLTextAreaElement).value).toBe("Keep this message");
});
