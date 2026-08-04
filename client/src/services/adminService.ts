import api from "@/lib/api";
import type {
  AdminUserModel,
  AIAdminOverviewModel,
  AIAdminRunModel,
  AIConversationDetailModel,
  AIConversationListItemModel,
  AIConversationQueryRequest,
  AICostSummaryModel,
  AISettingsModel,
  AIUserCostBreakdownModel,
  AIUserCostQueryRequest,
  SaveAISettingsRequest,
  AIRunQueryRequest,
  AIAdminUsageSummaryModel,
  AssignPlanOverrideRequest,
  CreateMuscleGroupRequest,
  ErrorModel,
  ErrorQueryRequest,
  Exercise,
  ExerciseQueryRequest,
  JsonData,
  MuscleGroup,
  MuscleGroupQueryRequest,
  PagedResponse,
  SavePlanRequest,
  SubscriptionPlanAdminModel,
  SubscriptionQueryRequest,
  UnsupportedAIRequestModel,
  UnsupportedRequestQueryRequest,
  UpdateUnsupportedRequestRequest,
  UpdateUserRequest,
  UsageQueryRequest,
  UserQueryRequest,
  UserSubscriptionAdminModel,
  UserUsageAdminModel,
} from "@/types";

export const adminService = {
  users: {
    async list(params: UserQueryRequest) {
      return api.get<JsonData<PagedResponse<AdminUserModel>>>("admin/users", { params });
    },

    async update(id: number, payload: UpdateUserRequest) {
      return api.put<JsonData<AdminUserModel>>(`admin/users/${id}`, payload);
    },

    async remove(id: number) {
      return api.delete<JsonData<boolean>>(`admin/users/${id}`);
    },
  },

  muscleGroups: {
    async list(params: MuscleGroupQueryRequest) {
      return api.get<JsonData<PagedResponse<MuscleGroup>>>("admin/musclegroups", { params });
    },

    async update(id: number, payload: CreateMuscleGroupRequest) {
      return api.put<JsonData<MuscleGroup>>(`admin/musclegroups/${id}`, payload);
    },

    async remove(id: number) {
      return api.delete<JsonData<boolean>>(`admin/musclegroups/${id}`);
    },
  },

  exercises: {
    async list(params: ExerciseQueryRequest) {
      return api.get<JsonData<PagedResponse<Exercise>>>("admin/exercises", { params });
    },
  },

  errors: {
    async list(params: ErrorQueryRequest) {
      return api.get<JsonData<PagedResponse<ErrorModel>>>("admin/errors", { params });
    },

    async remove(id: number) {
      return api.delete<JsonData<boolean>>(`admin/errors/${id}`);
    },

    async clearAll() {
      return api.delete<JsonData<number>>("admin/errors/all");
    },
  },

  ai: {
    async overview(days: number) {
      return api.get<JsonData<AIAdminOverviewModel>>("admin/ai/overview", { params: { days } });
    },

    async listConversations(params: AIConversationQueryRequest) {
      return api.get<JsonData<PagedResponse<AIConversationListItemModel>>>("admin/ai/conversations", {
        params,
      });
    },

    async getConversation(id: number) {
      return api.get<JsonData<AIConversationDetailModel>>(`admin/ai/conversations/${id}`);
    },

    async listRuns(params: AIRunQueryRequest) {
      return api.get<JsonData<PagedResponse<AIAdminRunModel>>>("admin/ai/runs", { params });
    },

    async getRun(id: number) {
      return api.get<JsonData<AIAdminRunModel>>(`admin/ai/runs/${id}`);
    },

    async usage(periodStart?: string) {
      return api.get<JsonData<AIAdminUsageSummaryModel>>("admin/ai/usage", { params: { periodStart } });
    },

    async costs(days: number) {
      return api.get<JsonData<AICostSummaryModel>>("admin/ai/costs", { params: { days } });
    },

    async userCosts(params: AIUserCostQueryRequest) {
      return api.get<JsonData<PagedResponse<AIUserCostBreakdownModel>>>("admin/ai/costs/users", {
        params,
      });
    },

    async settings() {
      return api.get<JsonData<AISettingsModel>>("admin/ai/settings");
    },

    async saveSettings(payload: SaveAISettingsRequest) {
      return api.put<JsonData<AISettingsModel>>("admin/ai/settings", payload);
    },

    async availableModels() {
      return api.get<JsonData<string[]>>("admin/ai/settings/models");
    },
  },

  unsupportedRequests: {
    async list(params: UnsupportedRequestQueryRequest) {
      return api.get<JsonData<PagedResponse<UnsupportedAIRequestModel>>>(
        "admin/ai/unsupported-requests",
        { params },
      );
    },

    async categories() {
      return api.get<JsonData<string[]>>("admin/ai/unsupported-requests/categories");
    },

    async getById(id: number) {
      return api.get<JsonData<UnsupportedAIRequestModel>>(`admin/ai/unsupported-requests/${id}`);
    },

    async update(id: number, payload: UpdateUnsupportedRequestRequest) {
      return api.put<JsonData<UnsupportedAIRequestModel>>(
        `admin/ai/unsupported-requests/${id}`,
        payload,
      );
    },
  },

  subscriptionPlans: {
    async list() {
      return api.get<JsonData<SubscriptionPlanAdminModel[]>>("admin/subscription-plans");
    },

    async getById(id: number) {
      return api.get<JsonData<SubscriptionPlanAdminModel>>(`admin/subscription-plans/${id}`);
    },

    async create(payload: SavePlanRequest) {
      return api.post<JsonData<SubscriptionPlanAdminModel>>("admin/subscription-plans", payload);
    },

    async update(id: number, payload: SavePlanRequest) {
      return api.put<JsonData<SubscriptionPlanAdminModel>>(`admin/subscription-plans/${id}`, payload);
    },

    async setActive(id: number, isActive: boolean) {
      return api.post<JsonData<SubscriptionPlanAdminModel>>(
        `admin/subscription-plans/${id}/active`,
        null,
        { params: { isActive } },
      );
    },
  },

  subscriptions: {
    async list(params: SubscriptionQueryRequest) {
      return api.get<JsonData<PagedResponse<UserSubscriptionAdminModel>>>("admin/subscriptions", {
        params,
      });
    },

    async getByUserId(userId: number) {
      return api.get<JsonData<UserSubscriptionAdminModel>>(`admin/subscriptions/${userId}`);
    },

    async assignOverride(userId: number, payload: AssignPlanOverrideRequest) {
      return api.post<JsonData<UserSubscriptionAdminModel>>(
        `admin/subscriptions/${userId}/override`,
        payload,
      );
    },

    async removeOverride(userId: number) {
      return api.delete<JsonData<UserSubscriptionAdminModel>>(`admin/subscriptions/${userId}/override`);
    },
  },

  usage: {
    async list(params: UsageQueryRequest) {
      return api.get<JsonData<PagedResponse<UserUsageAdminModel>>>("admin/usage", { params });
    },

    async reset(id: number) {
      return api.post<JsonData<UserUsageAdminModel>>(`admin/usage/${id}/reset`);
    },
  },
};
