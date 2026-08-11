import api, { apiUrl } from "@/lib/api";
import type {
  AIActionModel,
  AIConversationModel,
  AIConversationSummaryModel,
  AIRunSnapshotModel,
  AIUsageSummaryModel,
  CreateAIConversationRequest,
  JsonData,
  SendAIMessageRequest,
  StartAIRunResponse,
} from "@/types";

export const aiService = {
  async listConversations() {
    return api.get<JsonData<AIConversationSummaryModel[]>>("ai/conversations");
  },

  async createConversation(payload: CreateAIConversationRequest = {}) {
    return api.post<JsonData<AIConversationModel>>("ai/conversations", payload);
  },

  async getConversation(id: number) {
    return api.get<JsonData<AIConversationModel>>(`ai/conversations/${id}`);
  },

  async deleteConversation(id: number) {
    return api.delete<JsonData<boolean>>(`ai/conversations/${id}`);
  },

  async startMessage(id: number, payload: SendAIMessageRequest) {
    return api.post<JsonData<StartAIRunResponse>>(`ai/conversations/${id}/messages`, payload);
  },

  async getRunSnapshot(runId: number, afterEventId = 0) {
    return api.get<JsonData<AIRunSnapshotModel>>(`ai/runs/${runId}?afterEventId=${afterEventId}`);
  },

  runEventsUrl(runId: number, afterEventId = 0) {
    return apiUrl(`ai/runs/${runId}/events?afterEventId=${afterEventId}`);
  },

  async getUsage() {
    return api.get<JsonData<AIUsageSummaryModel>>("ai/usage");
  },

  async getAction(actionId: number) {
    return api.get<JsonData<AIActionModel>>(`ai/actions/${actionId}`);
  },

  async confirmAction(actionId: number) {
    return api.post<JsonData<AIActionModel>>(`ai/actions/${actionId}/confirm`);
  },

  async rejectAction(actionId: number) {
    return api.post<JsonData<AIActionModel>>(`ai/actions/${actionId}/reject`);
  },
};
