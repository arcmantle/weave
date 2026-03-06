/**
 * DOM Type Resolver
 *
 * Reads TypeScript's lib.dom.d.ts to resolve:
 * - Event names → DOM Event types (e.g. "click" → "MouseEvent")
 * - Element property types (e.g. input.value → "string")
 *
 * Parses HTMLElementTagNameMap, interface inheritance chains,
 * and interface property declarations for full type resolution.
 */
import * as fs from 'fs';
import * as path from 'path';

import { log } from './logger';


let eventMap: Map<string, string> | undefined;

/** tag name → DOM interface name (e.g. "input" → "HTMLInputElement") */
let tagInterfaceMap: Map<string, string> | undefined;

/** interface name → list of parent interface names */
let interfaceExtends: Map<string, string[]> | undefined;

/** interface name → Map<property name, type string> (own properties only) */
let interfaceProperties: Map<string, Map<string, string>> | undefined;


/**
 * Returns the DOM Event type for a given event name (e.g. "click" → "MouseEvent").
 * Falls back to "Event" if the type can't be resolved.
 */
export function getEventType(eventName: string): string {
	return eventMap?.get(eventName) ?? 'Event';
}


/**
 * Returns the type of a DOM property on a given HTML element tag.
 * Walks the interface inheritance chain to resolve inherited properties.
 * Returns undefined if the property or tag is not found.
 */
export function getPropertyType(tagName: string, propertyName: string): string | undefined {
	if (!tagInterfaceMap || !interfaceExtends || !interfaceProperties)
		return undefined;

	const interfaceName = tagInterfaceMap.get(tagName.toLowerCase());
	if (!interfaceName)
		return undefined;

	return resolvePropertyType(interfaceName, propertyName);
}


function resolvePropertyType(
	interfaceName: string,
	propertyName: string,
	visited: Set<string> = new Set(),
): string | undefined {
	if (visited.has(interfaceName))
		return undefined;

	visited.add(interfaceName);

	// Check own properties
	const props = interfaceProperties?.get(interfaceName);
	if (props) {
		const type = props.get(propertyName);
		if (type)
			return type;
	}

	// Walk parent chain
	const parents = interfaceExtends?.get(interfaceName);
	if (parents) {
		for (const parent of parents) {
			const type = resolvePropertyType(parent, propertyName, visited);
			if (type)
				return type;
		}
	}

	return undefined;
}


/**
 * Initialize the DOM type resolver by reading lib.dom.d.ts
 * from the TypeScript typings found in the workspace.
 */
export function initEventTypeResolver(workspaceRoots: string[]): void {
	if (eventMap)
		return;

	eventMap = new Map();
	tagInterfaceMap = new Map();
	interfaceExtends = new Map();
	interfaceProperties = new Map();

	const libPath = findLibDom(workspaceRoots);
	if (!libPath) {
		log('DOMTypeResolver: lib.dom.d.ts not found');

		return;
	}

	try {
		const content = fs.readFileSync(libPath, 'utf-8');

		parseEventMap(content, 'GlobalEventHandlersEventMap', eventMap);
		parseEventMap(content, 'ElementEventMap', eventMap);
		parseTagInterfaceMap(content, tagInterfaceMap);
		parseAllInterfaces(content, interfaceExtends, interfaceProperties);

		log(`DOMTypeResolver: loaded ${ eventMap.size } event types, ${ tagInterfaceMap.size } tags, ${ interfaceProperties.size } interfaces from ${ libPath }`);
	}
	catch (err) {
		log(`DOMTypeResolver: failed to read lib.dom.d.ts: ${ err }`);
	}
}


function findLibDom(workspaceRoots: string[]): string | undefined {
	for (const root of workspaceRoots) {
		// Direct node_modules path (may be symlinked in pnpm)
		const direct = path.join(root, 'node_modules', 'typescript', 'lib', 'lib.dom.d.ts');
		if (fs.existsSync(direct))
			return direct;

		// Search subdirectories that may have their own node_modules
		try {
			const entries = fs.readdirSync(root, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.'))
					continue;

				const subPath = path.join(root, entry.name, 'node_modules', 'typescript', 'lib', 'lib.dom.d.ts');
				if (fs.existsSync(subPath))
					return subPath;
			}
		}
		catch {
			continue;
		}
	}

	return undefined;
}


function parseEventMap(
	content: string,
	interfaceName: string,
	map: Map<string, string>,
): void {
	const body = extractInterfaceBody(content, interfaceName);
	if (!body)
		return;

	// Parse "eventname": EventType;
	const propRe = /"([\w-]+)"\s*:\s*(\w+)/g;
	let match: RegExpExecArray | null;
	while ((match = propRe.exec(body)) !== null)
		map.set(match[1]!, match[2]!);
}


function parseTagInterfaceMap(
	content: string,
	map: Map<string, string>,
): void {
	const body = extractInterfaceBody(content, 'HTMLElementTagNameMap');
	if (!body)
		return;

	const propRe = /"([\w-]+)"\s*:\s*(\w+)/g;
	let match: RegExpExecArray | null;
	while ((match = propRe.exec(body)) !== null)
		map.set(match[1]!, match[2]!);
}


/**
 * Parses all `interface X extends Y, Z { ... }` declarations from lib.dom.d.ts.
 * Collects extends chains and property types for each interface.
 *
 * Only parses interfaces relevant to the HTML element hierarchy by following
 * references from HTMLElementTagNameMap outward.
 */
function parseAllInterfaces(
	content: string,
	extendsMap: Map<string, string[]>,
	propertiesMap: Map<string, Map<string, string>>,
): void {
	// Match interface declarations with optional extends clause
	const interfaceRe = /^interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/gm;
	let match: RegExpExecArray | null;

	while ((match = interfaceRe.exec(content)) !== null) {
		const name = match[1]!;
		const extendsClause = match[2]?.trim();

		// Parse extends
		if (extendsClause) {
			const parents = extendsClause.split(',').map(s => {
				// Strip generic parameters like EventTarget<...>
				const trimmed = s.trim();
				const angleIdx = trimmed.indexOf('<');

				return angleIdx >= 0 ? trimmed.slice(0, angleIdx) : trimmed;
			}).filter(Boolean);

			extendsMap.set(name, parents);
		}

		// Extract interface body and parse properties
		const body = extractInterfaceBodyFromPos(content, match.index + match[0].length - 1);
		if (!body)
			continue;

		const props: Map<string, string> = new Map();
		// Match:  readonly? propertyName: TypeExpression;
		const propRe = /(?:readonly\s+)?([\w$]+)\s*(?:\??\s*):\s*([^;]+);/g;
		let propMatch: RegExpExecArray | null;

		while ((propMatch = propRe.exec(body)) !== null) {
			const propName = propMatch[1]!;
			const propType = propMatch[2]!.trim();

			// Skip method signatures (contain parentheses in the "type")
			if (propType.includes('(') && !propType.startsWith('('))
				continue;

			props.set(propName, propType);
		}

		if (props.size > 0)
			propertiesMap.set(name, props);
	}
}


/** Extract the body text between the braces of a named interface. */
function extractInterfaceBody(content: string, interfaceName: string): string | undefined {
	const marker = `interface ${ interfaceName }`;
	const start = content.indexOf(marker);
	if (start === -1)
		return undefined;

	const braceStart = content.indexOf('{', start);
	if (braceStart === -1)
		return undefined;

	return extractInterfaceBodyFromPos(content, braceStart);
}


/** Extract the body text between matched braces starting at the given '{' position. */
function extractInterfaceBodyFromPos(content: string, braceStart: number): string | undefined {
	if (content[braceStart] !== '{')
		return undefined;

	let depth = 1;
	let pos = braceStart + 1;
	while (pos < content.length && depth > 0) {
		if (content[pos] === '{')
			depth++;
		else if (content[pos] === '}')
			depth--;

		pos++;
	}

	return content.slice(braceStart + 1, pos - 1);
}
