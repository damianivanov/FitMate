export interface JsonData<T>
{
	success: boolean;
	data?: T;
	error?: string;
	warning?: string;
}
