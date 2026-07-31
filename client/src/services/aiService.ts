import api from "@/lib/api";
import type {
  AIActionModel,
  AIConversationModel,
  AIConversationSummaryModel,
  AIUsageSummaryModel,
  CreateAIConversationRequest,
  JsonData,
  SendAIMessageRequest,
  SendAIMessageResponse,
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

  async sendMessage(id: number, payload: SendAIMessageRequest) {
    return api.post<JsonData<SendAIMessageResponse>>(`ai/conversations/${id}/messages`, payload);
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
