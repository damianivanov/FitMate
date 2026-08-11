export interface BuildInfoModel
{
	buildTimeUtc?: string;
	version: string;
	commitSha?: string;
	environmentName: string;
	startedAtUtc?: string;
}
