export interface AdminUserModel
{
	id: number;
	email: string;
	firstName?: string;
	lastName?: string;
	isActive: boolean;
	isAdmin: boolean;
	dateCreated: string;
	lastLoginAt?: string;
}
