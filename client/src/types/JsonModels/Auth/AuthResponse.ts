import type { JsonModels } from "../../backend";

export interface AuthResponse
{
	success: boolean;
	token?: string;
	refreshToken?: string;
	message?: string;
	user?: JsonModels.Auth.UserModel;
}
