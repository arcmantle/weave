type RunStep = {
	command?: string;
	args?: string[];
	parallel?: string[];
};

type DocArg = {
	name: string;
	type: string;
	description: string;
	required?: boolean;
	defaultValue?: string;
};

type DocCommand = {
	name: string;
	description: string;
	commandType: 'script' | 'composite';
	source?: string;
	sourcePath?: string;
	script?: string;
	scriptPath?: string;
	language?: string;
	example?: string;
	positionals?: DocArg[];
	flags?: DocArg[];
	steps?: RunStep[];
};

type DocRegistrySource = {
	name: string;
	count: number;
	sourceType?: string;
};

type DocInstallTarget = {
	path: string;
	label: string;
};

type DocData = {
	projectName?: string;
	version?: string;
	commands?: DocCommand[];
	templateCount?: number;
	registrySources?: DocRegistrySource[];
	installTargets?: DocInstallTarget[];
};

type DocTemplateVar = {
	name: string;
	description?: string;
	default?: string;
};

type DocTemplate = {
	id: string;
	name: string;
	description?: string;
	languages?: string[];
	variables?: DocTemplateVar[];
	example?: string;
	latestTag?: string;
	versions?: string[];
	source: string;
	sourceType?: string;
};

type DocTemplateSummary = {
	id: string;
	name: string;
	description?: string;
	languages?: string[];
	latestTag?: string;
	source: string;
	sourceType?: string;
};

type MetaStatusValue = 'pending' | 'compiling' | 'ready';
type MetaStatus = Record<string, MetaStatusValue>;

type RegistrySearchResponse = {
	total: number;
	offset: number;
	limit: number;
	hasMore: boolean;
	items: DocTemplateSummary[];
};

type SidebarRenderer = HTMLElement & {
	render: (
		commands: DocCommand[],
		templates: unknown[],
		metaStatus: MetaStatus,
		metaDone: boolean,
		searchQuery: string,
		activeCommand: string | null,
		activeTemplate: string | null
	) => void;
};

type CommandRenderer = HTMLElement & {
	render: (command: DocCommand, metaStatus: MetaStatus) => void;
};

type TemplateRenderer = HTMLElement;

type TemplatesRenderer = HTMLElement & {
	render: (template: DocTemplate, installTargets?: DocInstallTarget[]) => void;
};

type RunnerRenderer = HTMLElement & {
	render: (command: DocCommand) => void;
};

type RegistryRenderer = HTMLElement & {
	initialize?: (sources: DocRegistrySource[], targets: DocInstallTarget[]) => void;
};

declare function esc(value: string): string;
declare function renderMarkdown(source: string): string;
declare function chevronSvg(): string;
declare function fileSvg(): string;
declare function spinnerSvg(): string;
declare function playSvg(): string;
declare function stopSvg(): string;
declare function checkSvg(): string;
declare function linkSvg(): string;
declare function vscodeFileUrl(path: string): string;