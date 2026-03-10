import type { JsonModels } from "../../backend";

export interface AuthResponse
{
	success: boolean;
	message?: string;
	user?: JsonModels.Auth.UserModel;
}
