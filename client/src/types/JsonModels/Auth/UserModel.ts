import type { Enums } from "../../backend";

export interface UserModel
{
	id: number;
	email: string;
	firstName?: string;
	lastName?: string;
	roles: Enums.UserRole[];
}
