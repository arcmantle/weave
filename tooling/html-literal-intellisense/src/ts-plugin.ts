/**
 * TypeScript Language Service Plugin
 *
 * Provides type information for Lit-style bindings inside `html` tagged templates:
 * - `@event=${handler}` → resolves event type from GlobalEventHandlersEventMap
 * - `?attr=${expr}` → expects boolean
 * - `.prop=${expr}` → property binding
 *
 * Loaded by tsserver via `contributes.typescriptServerPlugins` in package.json.
 */
import type * as tslib from 'typescript/lib/tsserverlibrary';


/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BindingKind = 'event' | 'property' | 'boolean' | 'attribute' | 'content';

interface TemplateBinding {
	kind:       BindingKind;
	name:       string;
	tagName:    string | undefined;
	expression: tslib.Expression;
}

/** Regex to detect binding context from template text preceding `${}`. */
const BINDING_CONTEXT_RE = /\s([.?@]?)([\w-]+)\s*=\s*['"]?\s*$/;

/** Regex to find the last opening tag name before a binding position. */
const TAG_NAME_RE = /<([a-zA-Z][\w-]*)/g;

/** Custom diagnostic code for html-literal-intellisense. */
const DIAG_CODE_UNTYPED_EVENT_PARAM = 99001;
const DIAG_CODE_EXPECT_BOOLEAN      = 99002;
const DIAG_CODE_PROPERTY_TYPE       = 99003;
const DIAG_CODE_EVENT_NOT_CALLABLE  = 99004;

const FIX_ID_ADD_EVENT_TYPE = 'htmlLiteral.addEventType';


/* ------------------------------------------------------------------ */
/*  Plugin entry                                                       */
/* ------------------------------------------------------------------ */

function init(modules: { typescript: typeof tslib; }): tslib.server.PluginModule {
	const ts = modules.typescript;

	function create(info: tslib.server.PluginCreateInfo): tslib.LanguageService {
		const logger = info.project.projectService.logger;
		logger.info('[html-literal] TS plugin loaded');

		const config = info.config || {};
		const tagNames: Set<string> = new Set(
			((config.tagNames as string[] | undefined) ?? [ 'html' ]).map(n => n.toLowerCase()),
		);

		// Create proxy that forwards everything to the original service
		const proxy = Object.create(null) as tslib.LanguageService;
		for (const key of Object.keys(info.languageService) as (keyof tslib.LanguageService)[]) {
			const original = info.languageService[key]!;
			(proxy as any)[key] = (...args: any[]) => (original as any).apply(info.languageService, args);
		}

		/* ---------- getQuickInfoAtPosition ---------- */
		proxy.getQuickInfoAtPosition = (fileName, position) => {
			const original = info.languageService.getQuickInfoAtPosition(fileName, position);

			try {
				const program = info.languageService.getProgram();
				if (!program)
					return original;

				const sourceFile = program.getSourceFile(fileName);
				if (!sourceFile)
					return original;

				const binding = findBindingAtPosition(sourceFile, position, tagNames);
				if (!binding)
					return original;

				const checker = program.getTypeChecker();

				return enhanceQuickInfo(original, binding, position, checker, sourceFile);
			}
			catch {
				return original;
			}
		};

		/* ---------- getSemanticDiagnostics ---------- */
		proxy.getSemanticDiagnostics = (fileName) => {
			const original = info.languageService.getSemanticDiagnostics(fileName);

			try {
				const program = info.languageService.getProgram();
				if (!program)
					return original;

				const sourceFile = program.getSourceFile(fileName);
				if (!sourceFile)
					return original;

				const checker = program.getTypeChecker();
				const bindings = findAllBindings(sourceFile, tagNames);
				const extra = generateDiagnostics(sourceFile, checker, bindings);

				return extra.length > 0 ? [ ...original, ...extra ] : original;
			}
			catch {
				return original;
			}
		};

		/* ---------- getCodeFixesAtPosition ---------- */
		proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
			const original = info.languageService.getCodeFixesAtPosition(
				fileName, start, end, errorCodes, formatOptions, preferences,
			);

			try {
				if (!errorCodes.includes(DIAG_CODE_UNTYPED_EVENT_PARAM))
					return original;

				const program = info.languageService.getProgram();
				if (!program)
					return original;

				const sourceFile = program.getSourceFile(fileName);
				if (!sourceFile)
					return original;

				const checker = program.getTypeChecker();
				const binding = findBindingAtPosition(sourceFile, start, tagNames);
				if (!binding || binding.kind !== 'event')
					return original;

				const expr = binding.expression;
				if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr))
					return original;

				const firstParam = expr.parameters[0];
				if (!firstParam || firstParam.type)
					return original;

				const eventTypeName = resolveEventType(checker, binding.name, sourceFile);
				const paramEnd = firstParam.name.getEnd();

				const fix: tslib.CodeFixAction = {
					fixName:     FIX_ID_ADD_EVENT_TYPE,
					description: `Add type annotation: ${ eventTypeName }`,
					changes:     [
						{
							fileName,
							textChanges: [
								{
									span:    { start: paramEnd, length: 0 },
									newText: `: ${ eventTypeName }`,
								},
							],
						},
					],
					fixId:             FIX_ID_ADD_EVENT_TYPE,
					fixAllDescription: 'Add event type annotations to all untyped event handlers',
				};

				return [ ...original, fix ];
			}
			catch {
				return original;
			}
		};

		return proxy;


		/* ============================================================ */
		/*  Resolve event types from DOM lib typings                    */
		/* ============================================================ */

		/**
		 * Looks up the event type for a given event name from
		 * GlobalEventHandlersEventMap in TypeScript's DOM lib typings.
		 * Falls back to 'Event' if the type can't be resolved.
		 */
		function resolveEventType(
			checker: tslib.TypeChecker,
			eventName: string,
			location: tslib.Node,
		): string {
			try {
				// Use checker's internal resolveName to find GlobalEventHandlersEventMap
				const resolveName = (checker as any).resolveName as
					((name: string, location: tslib.Node | undefined,
						meaning: tslib.SymbolFlags, excludeGlobals: boolean) => tslib.Symbol | undefined)
					| undefined;

				if (typeof resolveName !== 'function')
					return 'Event';

				const mapSymbol = resolveName.call(
					checker, 'GlobalEventHandlersEventMap', location, ts.SymbolFlags.Type, false,
				);

				if (!mapSymbol)
					return 'Event';

				const mapType = checker.getDeclaredTypeOfSymbol(mapSymbol);
				const prop = mapType.getProperty(eventName);
				if (!prop)
					return 'Event';

				const eventType = checker.getTypeOfSymbol(prop);

				return checker.typeToString(eventType);
			}
			catch {
				return 'Event';
			}
		}


		/* ============================================================ */
		/*  AST traversal helpers                                       */
		/* ============================================================ */

		function getTagName(tag: tslib.Expression): string | undefined {
			if (ts.isIdentifier(tag))
				return tag.text;
			if (ts.isPropertyAccessExpression(tag))
				return tag.name.text;

			return undefined;
		}


		function getPrecedingText(
			template: tslib.TemplateExpression,
			spanIndex: number,
		): string {
			if (spanIndex === 0)
				return template.head.text;

			return template.templateSpans[spanIndex - 1]!.literal.text;
		}


		/**
		 * Collects all template text from the head through all spans up to
		 * (and including) the span at spanIndex. This gives us the full HTML
		 * context needed to determine the enclosing tag name.
		 */
		function getAllPrecedingText(
			template: tslib.TemplateExpression,
			spanIndex: number,
		): string {
			let text = template.head.text;

			for (let i = 0; i < spanIndex; i++)
				text += '___' + template.templateSpans[i]!.literal.text;

			return text;
		}


		function parseBindingContext(
			precedingText: string,
			allPrecedingText: string,
			expression: tslib.Expression,
		): TemplateBinding {
			const match = precedingText.match(BINDING_CONTEXT_RE);

			if (!match)
				return { kind: 'content', name: '', tagName: undefined, expression };

			const prefix = match[1]!;
			const name = match[2]!;
			const tagName = findLastOpenTag(allPrecedingText);

			if (prefix === '@')
				return { kind: 'event', name, tagName, expression };
			if (prefix === '.')
				return { kind: 'property', name, tagName, expression };
			if (prefix === '?')
				return { kind: 'boolean', name, tagName, expression };

			return { kind: 'attribute', name, tagName, expression };
		}


		/**
		 * Finds the tag name of the last unclosed opening tag in the accumulated
		 * template text up to the binding position.
		 */
		function findLastOpenTag(text: string): string | undefined {
			// Track open/close tags to find the enclosing one
			const openTags: string[] = [];

			// Find all tags in the text
			const allTagsRe = /<\/?([a-zA-Z][\w-]*)[^>]*\/?>/g;
			let tagMatch: RegExpExecArray | null;

			while ((tagMatch = allTagsRe.exec(text)) !== null) {
				const fullMatch = tagMatch[0]!;
				const name = tagMatch[1]!.toLowerCase();

				if (fullMatch.startsWith('</')) {
					// Closing tag — pop matching open tag
					const idx = openTags.lastIndexOf(name);
					if (idx >= 0)
						openTags.splice(idx, 1);
				}
				else if (!fullMatch.endsWith('/>')) {
					// Opening tag (not self-closing)
					openTags.push(name);
				}
			}

			// The text ends mid-tag (before '>'), so check for an unclosed '<tagname'
			let lastTag: string | undefined;
			TAG_NAME_RE.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = TAG_NAME_RE.exec(text)) !== null)
				lastTag = m[1]!.toLowerCase();

			// If the text ends inside an unclosed tag, that's our enclosing tag
			// (the binding is an attribute of this tag)
			if (lastTag) {
				// Check if the last '<tagname' is still unclosed (no matching '>' after it)
				const lastOpenBracket = text.lastIndexOf('<');
				const lastCloseBracket = text.lastIndexOf('>');

				if (lastOpenBracket > lastCloseBracket)
					return lastTag;
			}

			// Fall back to the last open tag in the stack
			return openTags.length > 0 ? openTags[openTags.length - 1] : undefined;
		}


		function visitTemplateSpans(
			template: tslib.TemplateExpression,
			tagNameSet: Set<string>,
			callback: (binding: TemplateBinding) => void,
		): void {
			for (let i = 0; i < template.templateSpans.length; i++) {
				const span = template.templateSpans[i]!;
				const precedingText = getPrecedingText(template, i);
				const allPrecedingText = getAllPrecedingText(template, i);
				const binding = parseBindingContext(precedingText, allPrecedingText, span.expression);

				callback(binding);

				// Recurse into the expression to find nested html`` templates
				visitNode(span.expression, tagNameSet, callback);
			}
		}


		function visitNode(
			node: tslib.Node,
			tagNameSet: Set<string>,
			callback: (binding: TemplateBinding) => void,
		): void {
			if (ts.isTaggedTemplateExpression(node)) {
				const name = getTagName(node.tag);
				if (name && tagNameSet.has(name.toLowerCase())) {
					if (ts.isTemplateExpression(node.template))
						visitTemplateSpans(node.template, tagNameSet, callback);

					return;
				}
			}

			ts.forEachChild(node, child => visitNode(child, tagNameSet, callback));
		}


		function findBindingAtPosition(
			sourceFile: tslib.SourceFile,
			position: number,
			tagNameSet: Set<string>,
		): TemplateBinding | undefined {
			let result: TemplateBinding | undefined;

			function visit(node: tslib.Node): void {
				if (result)
					return;

				if (ts.isTaggedTemplateExpression(node)) {
					const name = getTagName(node.tag);
					if (name && tagNameSet.has(name.toLowerCase())) {
						const template = node.template;
						if (ts.isTemplateExpression(template)) {
							for (let i = 0; i < template.templateSpans.length; i++) {
								const span = template.templateSpans[i]!;
								const exprStart = span.expression.getStart(sourceFile);
								const exprEnd = span.expression.getEnd();

								if (position >= exprStart && position <= exprEnd) {
									const precedingText = getPrecedingText(template, i);
									const allPrecedingText = getAllPrecedingText(template, i);
									result = parseBindingContext(precedingText, allPrecedingText, span.expression);

									return;
								}
							}
						}

						// Still recurse into template span expressions for nested templates
						if (ts.isTemplateExpression(template)) {
							for (const span of template.templateSpans)
								visit(span.expression);
						}

						return;
					}
				}

				ts.forEachChild(node, visit);
			}

			visit(sourceFile);

			return result;
		}


		function findAllBindings(
			sourceFile: tslib.SourceFile,
			tagNameSet: Set<string>,
		): TemplateBinding[] {
			const bindings: TemplateBinding[] = [];
			visitNode(sourceFile, tagNameSet, b => bindings.push(b));

			return bindings;
		}


		/* ============================================================ */
		/*  Quick info enhancement                                      */
		/* ============================================================ */

		function enhanceQuickInfo(
			original: tslib.QuickInfo | undefined,
			binding: TemplateBinding,
			position: number,
			checker: tslib.TypeChecker,
			sourceFile: tslib.SourceFile,
		): tslib.QuickInfo {
			let extra = '';

			if (binding.kind === 'event') {
				const eventTypeName = resolveEventType(checker, binding.name, sourceFile);
				extra = `\n\nLit event binding: @${ binding.name }\n`
					+ `Expected handler: (event: ${ eventTypeName }) => void`;
			}
			else if (binding.kind === 'property') {
				const propType = binding.tagName
					? resolvePropertyTypeFromChecker(checker, binding.tagName, binding.name, sourceFile)
					: undefined;
				extra = `\n\nLit property binding: .${ binding.name }`;
				if (propType)
					extra += `\nExpected type: ${ checker.typeToString(propType) }`;
			}
			else if (binding.kind === 'boolean') {
				extra = `\n\nLit boolean binding: ?${ binding.name }\n`
					+ 'Expected type: boolean';
			}
			else if (binding.kind === 'attribute') {
				extra = `\n\nLit attribute binding: ${ binding.name }`;
			}

			if (!extra)
				return original!;

			if (original) {
				return {
					...original,
					documentation: [
						...(original.documentation ?? []),
						{ text: extra, kind: 'text' },
					],
				};
			}

			return {
				kind:          ts.ScriptElementKind.unknown,
				kindModifiers: '',
				textSpan:      { start: position, length: 0 },
				documentation: [ { text: extra, kind: 'text' } ],
				displayParts:  [],
			};
		}


		/* ============================================================ */
		/*  Diagnostics                                                 */
		/* ============================================================ */

		function generateDiagnostics(
			sourceFile: tslib.SourceFile,
			checker: tslib.TypeChecker,
			bindings: TemplateBinding[],
		): tslib.Diagnostic[] {
			const diagnostics: tslib.Diagnostic[] = [];

			for (const binding of bindings) {
				if (binding.kind === 'event')
					checkEventBinding(binding, sourceFile, checker, diagnostics);
				else if (binding.kind === 'boolean')
					checkBooleanBinding(binding, sourceFile, checker, diagnostics);
				else if (binding.kind === 'property')
					checkPropertyBinding(binding, sourceFile, checker, diagnostics);
			}

			return diagnostics;
		}


		function checkEventBinding(
			binding: TemplateBinding,
			sourceFile: tslib.SourceFile,
			checker: tslib.TypeChecker,
			diagnostics: tslib.Diagnostic[],
		): void {
			const expr = binding.expression;
			const exprType = checker.getTypeAtLocation(expr);

			// Allow any / unknown — user opted out
			if (exprType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
				return;

			// Check that the expression is callable (has call signatures).
			// Event bindings must receive a function or EventListener.
			const callSignatures = exprType.getCallSignatures();
			const isCallable = callSignatures.length > 0;

			// Also allow EventListenerObject (has handleEvent method)
			const handleEventProp = exprType.getProperty('handleEvent');
			const isEventListenerObject = handleEventProp !== undefined
				&& checker.getTypeOfSymbol(handleEventProp).getCallSignatures().length > 0;

			// Null is acceptable (removes listener)
			const isNull = !!(exprType.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined));

			if (!isCallable && !isEventListenerObject && !isNull) {
				const typeStr = checker.typeToString(exprType);

				diagnostics.push({
					file:        sourceFile,
					start:       expr.getStart(sourceFile),
					length:      expr.getEnd() - expr.getStart(sourceFile),
					messageText: `Event binding '@${ binding.name }' expects a function, `
						+ `but got '${ typeStr }'.`,
					category: ts.DiagnosticCategory.Error,
					code:     DIAG_CODE_EVENT_NOT_CALLABLE,
					source:   'html-literal-intellisense',
				});

				return;
			}

			// For inline arrow/function expressions, suggest typing the event param
			if (!ts.isArrowFunction(expr) && !ts.isFunctionExpression(expr))
				return;

			const firstParam = expr.parameters[0];
			if (!firstParam || firstParam.type)
				return;

			const eventTypeName = resolveEventType(checker, binding.name, sourceFile);

			diagnostics.push({
				file:        sourceFile,
				start:       firstParam.getStart(sourceFile),
				length:      firstParam.getEnd() - firstParam.getStart(sourceFile),
				messageText: `Parameter '${ firstParam.name.getText(sourceFile) }' `
					+ `should be typed as '${ eventTypeName }' `
					+ `for the '@${ binding.name }' event binding.`,
				category: ts.DiagnosticCategory.Suggestion,
				code:     DIAG_CODE_UNTYPED_EVENT_PARAM,
				source:   'html-literal-intellisense',
			});
		}


		function checkBooleanBinding(
			binding: TemplateBinding,
			sourceFile: tslib.SourceFile,
			checker: tslib.TypeChecker,
			diagnostics: tslib.Diagnostic[],
		): void {
			const exprType = checker.getTypeAtLocation(binding.expression);
			const typeStr = checker.typeToString(exprType);

			// Be lenient: allow boolean, true, false, union with boolean, any, unknown
			if (
				exprType.flags & ts.TypeFlags.Boolean
				|| exprType.flags & ts.TypeFlags.BooleanLiteral
				|| exprType.flags & ts.TypeFlags.Any
				|| exprType.flags & ts.TypeFlags.Unknown
			)
				return;

			// Check union types — if any constituent is boolean, allow it
			if (exprType.isUnion()) {
				const hasBool = exprType.types.some(
					t => !!(t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)),
				);

				if (hasBool)
					return;
			}

			diagnostics.push({
				file:        sourceFile,
				start:       binding.expression.getStart(sourceFile),
				length:      binding.expression.getEnd() - binding.expression.getStart(sourceFile),
				messageText: `Boolean attribute binding '?${ binding.name }' `
					+ `expects a boolean value, but got '${ typeStr }'.`,
				category: ts.DiagnosticCategory.Warning,
				code:     DIAG_CODE_EXPECT_BOOLEAN,
				source:   'html-literal-intellisense',
			});
		}


		function checkPropertyBinding(
			binding: TemplateBinding,
			sourceFile: tslib.SourceFile,
			checker: tslib.TypeChecker,
			diagnostics: tslib.Diagnostic[],
		): void {
			if (!binding.tagName)
				return;

			const expectedType = resolvePropertyTypeFromChecker(
				checker, binding.tagName, binding.name, sourceFile,
			);

			// If we can't resolve the expected type, skip — the property may
			// be on a custom element or not in the DOM typings.
			if (!expectedType)
				return;

			const actualType = checker.getTypeAtLocation(binding.expression);

			// Allow any / unknown — user explicitly opted out of typing
			if (actualType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
				return;

			if (!checker.isTypeAssignableTo(actualType, expectedType)) {
				const actualStr = checker.typeToString(actualType);
				const expectedStr = checker.typeToString(expectedType);

				diagnostics.push({
					file:        sourceFile,
					start:       binding.expression.getStart(sourceFile),
					length:      binding.expression.getEnd() - binding.expression.getStart(sourceFile),
					messageText: `Type '${ actualStr }' is not assignable to `
						+ `property '.${ binding.name }' of type '${ expectedStr }' `
						+ `on <${ binding.tagName }>.`,
					category: ts.DiagnosticCategory.Error,
					code:     DIAG_CODE_PROPERTY_TYPE,
					source:   'html-literal-intellisense',
				});
			}
		}


		/* ============================================================ */
		/*  Property type resolution via TS type checker                */
		/* ============================================================ */

		/**
		 * Resolves the expected type of a property on an HTML element.
		 * Uses the TypeScript type checker to walk:
		 *   HTMLElementTagNameMap[tagName] → interface → property type
		 *
		 * This gives us real structural type information, not string-based.
		 */
		function resolvePropertyTypeFromChecker(
			checker: tslib.TypeChecker,
			tagName: string,
			propertyName: string,
			location: tslib.Node,
		): tslib.Type | undefined {
			try {
				const resolveName = (checker as any).resolveName as
					((name: string, location: tslib.Node | undefined,
						meaning: tslib.SymbolFlags, excludeGlobals: boolean) => tslib.Symbol | undefined)
					| undefined;

				if (typeof resolveName !== 'function')
					return undefined;

				const mapSymbol = resolveName.call(
					checker, 'HTMLElementTagNameMap', location, ts.SymbolFlags.Type, false,
				);

				if (!mapSymbol)
					return undefined;

				const mapType = checker.getDeclaredTypeOfSymbol(mapSymbol);
				const tagProp = mapType.getProperty(tagName);
				if (!tagProp)
					return undefined;

				// Get the element interface type (e.g. HTMLInputElement)
				const elementType = checker.getTypeOfSymbol(tagProp);

				// Look up the property on the element interface
				const propSymbol = elementType.getProperty(propertyName);
				if (!propSymbol)
					return undefined;

				return checker.getTypeOfSymbol(propSymbol);
			}
			catch {
				return undefined;
			}
		}
	}

	return { create };
}


export default init;
