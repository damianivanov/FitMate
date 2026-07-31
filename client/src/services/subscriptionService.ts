import api from "@/lib/api";
import type {
  CurrentSubscriptionModel,
  EffectiveEntitlementsModel,
  JsonData,
  SubscriptionPlanModel,
} from "@/types";

export const subscriptionService = {
  async getMine() {
    return api.get<JsonData<CurrentSubscriptionModel>>("subscriptions/me");
  },

  async getPlans() {
    return api.get<JsonData<SubscriptionPlanModel[]>>("subscriptions/plans");
  },

  async getUsage() {
    return api.get<JsonData<EffectiveEntitlementsModel>>("subscriptions/usage");
  },
};
