export interface ErrorModel
{
	id: number;
	source?: string;
	action?: string;
	requestUrl: string;
	userAgent?: string;
	message: string;
	exception?: string;
	dateCreated: string;
	createdById?: number;
	createdByEmail?: string;
}
