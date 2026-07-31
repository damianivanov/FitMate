import type { UserRole } from "../Enums/UserRole";

export interface UserModel
{
	id: number;
	email: string;
	firstName?: string;
	lastName?: string;
	roles: UserRole[];
	cookieConsentAnalytics?: boolean;
	cookieConsentMarketing?: boolean;
	cookieConsentAt?: string;
}
