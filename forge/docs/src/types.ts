export interface RunStep {
	command?:  string;
	args?:     string[];
	parallel?: string[];
}

export interface DocArg {
	name:          string;
	type:          string;
	description:   string;
	required?:     boolean;
	defaultValue?: string;
}

export interface DocCommand {
	name:         string;
	description:  string;
	commandType:  'script' | 'composite';
	source?:      string;
	runPath?:     string;
	sourcePath?:  string;
	script?:      string;
	scriptPath?:  string;
	language?:    string;
	example?:     string;
	positionals?: DocArg[];
	flags?:       DocArg[];
	steps?:       RunStep[];
}

export interface DocRegistrySource {
	name:        string;
	count:       number;
	sourceType?: string;
}

export interface DocInstallTarget {
	path:  string;
	label: string;
}

export interface DocData {
	projectName?:     string;
	version?:         string;
	runCwd?:          string;
	commands?:        DocCommand[];
	templateCount?:   number;
	registrySources?: DocRegistrySource[];
	installTargets?:  DocInstallTarget[];
}

export interface DocTemplateVar {
	name:         string;
	description?: string;
	default?:     string;
}

export interface DocTemplate {
	id:           string;
	name:         string;
	description?: string;
	languages?:   string[];
	variables?:   DocTemplateVar[];
	example?:     string;
	latestTag?:   string;
	versions?:    string[];
	source:       string;
	sourceType?:  string;
}

export interface DocTemplateSummary {
	id:           string;
	name:         string;
	description?: string;
	languages?:   string[];
	latestTag?:   string;
	source:       string;
	sourceType?:  string;
}

export type MetaStatusValue = 'pending' | 'compiling' | 'ready';
export type MetaStatus = Record<string, MetaStatusValue>;

export interface RegistrySearchResponse {
	total:   number;
	offset:  number;
	limit:   number;
	hasMore: boolean;
	items:   DocTemplateSummary[];
}

export type SidebarRenderer = HTMLElement & {
	setData: (
		commands: DocCommand[],
		templates: DocTemplate[],
		metaStatus: MetaStatus,
		metaDone: boolean,
		searchQuery: string,
		activeCommand: string | null,
		activeTemplate: string | null
	) => void;
};

export type CommandRenderer = HTMLElement & {
	setCommand:  (command: DocCommand, metaStatus: MetaStatus) => void;
	setWelcome?: (stats: {
		total:      number;
		local:      number;
		inherited:  number;
		scripts:    number;
		composites: number;
		templates:  number;
	}) => void;
	setError?: (message: string) => void;
};

export type TemplateRenderer = HTMLElement & {
	setTemplate?: (template: DocTemplate, installTargets?: DocInstallTarget[]) => void;
};

export type TemplatesRenderer = HTMLElement & {
	setTemplate: (template: DocTemplate, installTargets?: DocInstallTarget[]) => void;
};

export type RunnerRenderer = HTMLElement & {
	setCommand: (command: DocCommand) => void;
};

export type RegistryRenderer = HTMLElement & {
	initialize?: (sources: DocRegistrySource[], targets: DocInstallTarget[]) => void;
};
