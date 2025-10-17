import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { transform } from 'lightningcss';
import type { CustomPluginOptions, PluginContext, SourceDescription } from 'rollup';
import ts from 'typescript';
import type { ResolvedConfig } from 'vite';


export class ImportCSSSheet {

	constructor(
		public config: ResolvedConfig,
		public transformers: ((code: string, id: string) => string)[],
		public additionalCode: string[],
		public minify: boolean,
		public autoImport: {
			identifier: [
				className: string,
				styleName: string,
			][];
		} | undefined = undefined,
	) {}

	virtualModules:   Map<string, string> = new Map();
	charReplacements: Map<string, string> = new Map([
		[ '\\', '\\\\' ],
		[ '`', '\\`' ],
		[ '$', '\\$' ],
	]);

	filetypes: Set<string> = new Set([
		'.ts',
		'.mts',
		'.tsx',
		'.mtsx',
		'.js',
		'.mjs',
		'.jsx',
		'.mjsx',
	]);

	transformedFiles: Map<string, string> = new Map();

	totalBeforeMinify = 0;
	totalAfterMinify = 0;

	convert(str: string): string {
		let res = '';
		for (const c of str)
			res += this.charReplacements.get(c) || c;

		return `\`${ res }\``;
	}

	cssImportAssertRegex(str: string): RegExp {
		return new RegExp(str + `['"] *(?:with|assert) *{ *type: *['"]css['"]`);
	}

	async resolveId(
		context: PluginContext,
		source: string,
		importer: string | undefined,
		options: {
			attributes: Record<string, string>;
			custom?:    CustomPluginOptions | undefined;
			ssr?:       boolean | undefined;
			isEntry:    boolean;
		},
	): Promise<string | undefined> {
		if (!source.endsWith('.css') || !importer)
			return;

		// Remove query string part of path.
		// Vite sometimes adds this to .html files.
		if (importer.includes('?'))
			importer = importer.split('?')[0]!;

		const ext = extname(importer);
		if (!this.filetypes.has(ext))
			return;

		const resolvedId = (await context.resolve(source, importer, options))?.id;
		if (!resolvedId)
			return;

		const importerContent = this.transformedFiles.get(importer)
			?? await readFile(importer, { encoding: 'utf8' });

		const regexp = this.cssImportAssertRegex(source);

		if (regexp.test(importerContent)) {
			const modId = '\0virtual:' + source.replace('.css', '.stylesheet');
			this.virtualModules.set(modId, resolvedId);

			return modId;
		}
	}

	async load(
		context: PluginContext,
		id: string,
		_options?: {
			ssr?: boolean | undefined;
		},
	): Promise<string | undefined> {
		if (!this.virtualModules.has(id))
			return;

		const realId = this.virtualModules.get(id)!;

		let fileContent = await readFile(realId, { encoding: 'utf8' });
		context.addWatchFile(realId);

		for (const transform of this.transformers)
			fileContent = transform(fileContent, realId);

		if (this.minify) {
			try {
				if (this.config.mode !== 'development')
					this.totalBeforeMinify += fileContent.length;

				const { code } = transform({
					code:     Buffer.from(fileContent),
					filename: realId,
					minify:   true,
				});

				const decoder = new TextDecoder();
				fileContent = decoder.decode(code);

				if (this.config.mode !== 'development')
					this.totalAfterMinify += fileContent.length;
			}
			catch (err) {
				console.error('Failed to minify css sheet');
				console.error(err);
			}
		}

		const createCode =
		`const styles = ${ this.convert(fileContent) }`
		+ `\n${ this.additionalCode.join('\n') }`
		+ '\nconst sheet = new CSSStyleSheet();'
		+ '\nsheet.replaceSync(styles);'
		+ '\nexport default sheet;';

		return createCode;
	}

	async transform(
		code: string,
		id: string,
		_options?: {
			ssr?: boolean | undefined;
		},
	): Promise<string | SourceDescription | undefined> {
		// Only process files if autoImport is configured and file is a supported type
		if (!this.autoImport || !this.filetypes.has(extname(id)))
			return;

		return this.processAutoImport(code, id);
	}

	protected processAutoImport(code: string, filePath: string): string | SourceDescription | undefined {
		const cssPath = filePath.slice(0, -extname(filePath).length) + '.css';
		if (!existsSync(cssPath))
			return;

		const autoImport = this.autoImport!;
		// Build a lookup of base class name => styleName
		const styleNameByBase: Map<string, string> = new Map(autoImport.identifier);

		// Fast pre-scan: only transform if any class extends a targeted base
		const sourceFile = ts.createSourceFile(
			filePath, code, ts.ScriptTarget.Latest, true,
		);

		let needsTransform = false;
		const visit = (node: ts.Node) => {
			if (needsTransform)
				return;
			if (ts.isClassDeclaration(node) && node.heritageClauses) {
				for (const heritage of node.heritageClauses) {
					if (heritage.token !== ts.SyntaxKind.ExtendsKeyword)
						continue;

					for (const type of heritage.types) {
						const typeName = type.expression.getText(sourceFile);
						if (styleNameByBase.has(typeName)) {
							needsTransform = true;

							return;
						}
					}
				}
			}

			ts.forEachChild(node, visit);
		};

		visit(sourceFile);

		if (!needsTransform)
			return;

		// Generate the CSS import variable name
		const fileName = basename(filePath, extname(filePath)).replace(/-/g, '_');
		const importVariable = `${ fileName }_styles`;

		// Use transpileModule to apply a transformer and get a sourcemap
		const transformer = this.createAutoImportTransformer(styleNameByBase, importVariable, filePath);
		const { outputText, sourceMapText } = ts.transpileModule(code, {
			fileName:        filePath,
			transformers:    { before: [ transformer ] },
			compilerOptions: {
				target:        ts.ScriptTarget.ES2020,
				module:        ts.ModuleKind.ESNext,
				sourceMap:     true,
				inlineSources: true,
			},
		});

		this.transformedFiles.set(filePath, outputText);

		return {
			code: outputText,
			map:  sourceMapText,
		};
	}

	protected createAutoImportTransformer(
		styleNameByBase: Map<string, string>,
		importVariable: string,
		filePath: string,
	): ts.TransformerFactory<ts.SourceFile> {
		const base = basename(filePath, extname(filePath));

		// Create the CSS import statement
		const cssImportDeclaration = ts.factory.createImportDeclaration(
			undefined,
			ts.factory.createImportClause(
				false,
				ts.factory.createIdentifier(importVariable),
				undefined,
			),
			ts.factory.createStringLiteral(`./${ base }.css`),
			ts.factory.createImportAttributes(
				ts.factory.createNodeArray([
					ts.factory.createImportAttribute(
						ts.factory.createIdentifier('type'),
						ts.factory.createStringLiteral('css'),
					),
				]),
			),
		);

		return context => {
			const visitClass: ts.Visitor = node => {
				if (!ts.isClassDeclaration(node) || !node.heritageClauses)
					return ts.visitEachChild(node, visitClass, context);

				let styleNameToUse: string | undefined;
				for (const heritage of node.heritageClauses) {
					if (heritage.token !== ts.SyntaxKind.ExtendsKeyword)
						continue;

					for (const type of heritage.types) {
						const typeName = type.expression.getText();
						const styleName = styleNameByBase.get(typeName);
						if (styleName) {
							styleNameToUse = styleName;
							break;
						}
					}
					if (styleNameToUse)
						break;
				}

				if (!styleNameToUse)
					return ts.visitEachChild(node, visitClass, context);

				return this.transformClassDeclaration(node, styleNameToUse, importVariable);
			};

			const visitSource: ts.Visitor = node => {
				if (!ts.isSourceFile(node))
					return node;

				const visited = ts.visitEachChild(node, visitClass, context) as ts.SourceFile;
				const statements = [ cssImportDeclaration, ...visited.statements ];

				return ts.factory.updateSourceFile(visited, statements);
			};

			return node => ts.visitNode(node, visitSource) as ts.SourceFile;
		};
	}

	protected transformClassDeclaration(
		classNode: ts.ClassDeclaration,
		styleName: string,
		importVariable: string,
	): ts.ClassDeclaration {
		// Find existing static property with the styleName
		let existingPropertyIndex = -1;
		let existingProperty: ts.PropertyDeclaration | undefined;

		for (let i = 0; i < classNode.members.length; i++) {
			const member = classNode.members[i];
			if (!member)
				continue;
			if (!ts.isPropertyDeclaration(member))
				continue;
			if (!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword))
				continue;
			if (!ts.isIdentifier(member.name))
				continue;
			if (member.name.text !== styleName)
				continue;

			existingPropertyIndex = i;
			existingProperty = member;

			break;
		}

		const importVariableExpression = ts.factory.createIdentifier(importVariable);
		let newProperty: ts.PropertyDeclaration;

		if (existingProperty) {
			// Modify existing property
			newProperty = this.modifyExistingProperty(existingProperty, importVariableExpression);
		}
		else {
			// Create new static property
			newProperty = ts.factory.createPropertyDeclaration(
				[ ts.factory.createModifier(ts.SyntaxKind.StaticKeyword) ],
				ts.factory.createIdentifier(styleName),
				undefined,
				undefined,
				ts.factory.createArrayLiteralExpression([ importVariableExpression ]),
			);
		}

		// Update the class members
		const newMembers = [ ...classNode.members ];
		if (existingPropertyIndex >= 0) {
			newMembers[existingPropertyIndex] = newProperty;
		}
		else {
			// Add at the beginning of the class
			newMembers.unshift(newProperty);
		}

		return ts.factory.updateClassDeclaration(
			classNode,
			classNode.modifiers,
			classNode.name,
			classNode.typeParameters,
			classNode.heritageClauses,
			newMembers,
		);
	}

	protected modifyExistingProperty(
		property: ts.PropertyDeclaration,
		importVariableExpression: ts.Identifier,
	): ts.PropertyDeclaration {
		let newInitializer: ts.Expression;

		if (property.initializer) {
			if (ts.isArrayLiteralExpression(property.initializer)) {
				// Already an array, unshift the import
				newInitializer = ts.factory.createArrayLiteralExpression([
					importVariableExpression,
					...property.initializer.elements,
				]);
			}
			else {
				// Not an array, convert to array with existing value
				newInitializer = ts.factory.createArrayLiteralExpression([
					importVariableExpression,
					property.initializer,
				]);
			}
		}
		else {
			// No initializer, create array with just the import
			newInitializer = ts.factory.createArrayLiteralExpression(
				[ importVariableExpression ],
			);
		}

		return ts.factory.updatePropertyDeclaration(
			property,
			property.modifiers,
			property.name,
			property.questionToken,
			property.type,
			newInitializer,
		);
	}

}
