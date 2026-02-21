import type { TrustedTypesWindow } from 'trusted-types/lib';

import type { Template } from './parts/template.ts';


export type GlobalType = typeof globalThis & TrustedTypesWindow & {
	TrustedTypes?:                  TrustedTypesWindow;
	litIssuedWarnings?:             Set<string>;
	// Even in dev mode, we generally don't want to emit these events, as that's
	// another level of cost, so only emit them when DEV_MODE is true _and_ when
	// window.emitLitDebugEvents is true.
	emitLitDebugLogEvents?:         boolean;
	litHtmlPolyfillSupportDevMode?: (template: typeof Template, child: any) => unknown;
	litHtmlPolyfillSupport?:        (template: typeof Template, child: any) => unknown;
	litHtmlVersions?:               string[];
	ShadyDOM?: {
		inUse:   boolean;
		noPatch: boolean;
		wrap:    <T extends Node>(node: T) => T;
	};
};
