import type { JsonModels } from "../../backend";
import type { EntitlementSource } from "../Enums/EntitlementSource";

export interface EffectiveEntitlementsModel
{
	planId: number;
	planCode: string;
	planName: string;
	source: EntitlementSource;
	features: JsonModels.Subscriptions.FeatureAvailabilityModel[];
}
