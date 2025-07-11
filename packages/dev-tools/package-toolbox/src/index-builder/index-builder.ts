import { readFile, writeFile } from 'node:fs/promises';
import { parse, resolve } from 'node:path';

import ts from 'typescript';

import { exists, genToArray, getFiles } from './path-helpers.ts';


/**
 * Builds a `targetFile` with exports from imports found in files accepted by the `pathMatchers`.
 */
export const indexBuilder = async (
	targetFile: string,
	pathMatchers: ((path: string) => boolean)[],
	options?: {
		/** @default `@internalexport` */
		exclusionJSDocTag?: string;
	},
): Promise<void> => {
	/* destructured options */
	const { exclusionJSDocTag = '@internalexport' } = options ?? {};

	/* Get the location of where this script is run from */
	const projectRoot = resolve();

	/* Resolve target */
	const pathTarget = resolve(projectRoot, targetFile);

	/* Get the target directory path, for use in creating relative paths */
	const dirTarget = parse(pathTarget).dir;

	const directoryExists = await exists(dirTarget);
	if (!directoryExists)
		return console.error('Directory does not exist!', dirTarget);

	/* Retrieve, map, filter and sort the file paths */
	const filePaths = (await genToArray(getFiles(dirTarget, /\.ts/)))
		.map(rawPath => ({ rawPath, path: rawPath.replaceAll('\\', '/') }))
		.filter(({ path }) => pathMatchers.some(fn => fn(path)));

	/* Extract exports from the files through ast parsing. */
	const exports = await Promise.all(filePaths.map(async ({ rawPath, path }) => {
		if (path.endsWith('/index.ts') || path.endsWith('/index.js'))
			return { path,	symbols: [], types: [] };

		const content: string = await readFile(rawPath, { encoding: 'utf8' });
		const fileName = path.split('/').at(-1) ?? path;

		const symbols: Set<string> = new Set();
		const types: Set<string> = new Set();

		const sourceFile = ts.createSourceFile(
			fileName,
			content,
			{ languageVersion: ts.ScriptTarget.ESNext },
			true,
			ts.ScriptKind.TS,
		);
		nodeTraverser(sourceFile, sourceFile, exclusionJSDocTag, symbols, types);

		return {
			path,
			symbols: Array.from(symbols),
			types:   Array.from(types),
		};
	}));

	const lines = exports.reduce((prev, { path, symbols, types }) => {
		if (symbols.length) {
			const line = `export { ${ symbols.join(', ') } }`
				+ ` from '${ path.replace('.ts', '.js') }';`;

			prev.push(line.replace(dirTarget.replaceAll('\\', '/'), '.'));
		}
		if (types.length) {
			const line = `export type { ${ types.join(', ') } }`
				+ ` from '${ path.replace('.ts', '.js') }';`;

			prev.push(line.replace(dirTarget.replaceAll('\\', '/'), '.'));
		}

		return prev;
	}, [] as string[]);

	/* Check if there is an existing index file, and retrieve the contents */
	const existingIndex = await exists(pathTarget)
		? await readFile(pathTarget, { encoding: 'utf8' })
		: '';

	lines.sort((a, b) => {
		let aSort = a.length;
		let bSort = b.length;

		if (a.includes('export type'))
			aSort = aSort + 1000;
		if (b.includes('export type'))
			bSort = bSort + 1000;

		return bSort - aSort;
	});

	lines.unshift('/* auto generated */');
	lines.unshift('/* eslint-disable */');
	lines.push('');

	const indexContent = lines.join('\n');

	/* only write the index file if it is different from what exists */
	if (indexContent !== existingIndex) {
		console.log('\n', 'create-index:', pathTarget);
		await writeFile(pathTarget, lines.join('\n'));
	}
};


const isExportKeyword = (node: ts.Node): node is ts.ExportKeyword =>
	node.kind === ts.SyntaxKind.ExportKeyword;


const nodeTraverser = (
	source: ts.SourceFile,
	node: ts.Node,
	exclusionTag: string,
	symbols = new Set<string>(),
	types = new Set<string>(),
) => {
	// handles grouped export syntax:
	// export { tester, TesterClass1 }
	// export type { tester, TesterClass1 }
	if (ts.isExportDeclaration(node)) {
		const jsDocTags = ts.getJSDocTags(node);
		const excludeExport = jsDocTags
			.some(tag => tag.tagName.getText() === exclusionTag.replace(/^@/, ''));

		if (!excludeExport) {
			if (node.isTypeOnly) {
				node.exportClause?.forEachChild(clause => {
					if (ts.isExportSpecifier(clause)) {
						const name = clause.name?.getText();
						if (name)
							types.add(name);
					}
				});
			}
			else {
				node.exportClause?.forEachChild(clause => {
					if (ts.isExportSpecifier(clause)) {
						const name = clause.name?.getText();
						if (name) {
							if (clause.isTypeOnly)
								types.add(name);
							else
								symbols.add(name);
						}
					}
				});
			}
		}
	}

	// Handles direct export syntax:
	// export const x = 1;
	// export function x() {}
	// export class x {}
	// export type x = string;
	if (isExportKeyword(node)) {
		const jsDocTags = ts.getJSDocTags(node.parent);
		const excludeExport = jsDocTags
			.some(tag => tag.tagName.getText() === exclusionTag.replace(/^@/, ''));

		if (!excludeExport) {
			const parent = node.parent;

			if (ts.isClassDeclaration(parent)) {
				const name = parent.name?.getText() ?? '';
				symbols.add(name);
			}
			else if (ts.isFunctionDeclaration(parent)) {
				const name = parent.name?.getText() ?? '';
				symbols.add(name);
			}
			else if (ts.isVariableStatement(parent)) {
				parent.declarationList.forEachChild(variableDeclaration => {
					if (ts.isVariableDeclaration(variableDeclaration)) {
						const name = variableDeclaration.name.getText() ?? '';
						symbols.add(name);
					}
				});
			}
			else if (ts.isInterfaceDeclaration(parent)) {
				const name = parent.name.getText();

				const parentsParent = parent.parent;
				if (parentsParent.kind === ts.SyntaxKind.SourceFile)
					types.add(name);
			}
			else if (ts.isTypeAliasDeclaration(parent)) {
				const name = parent.name.getText();

				const parentsParent = parent.parent;
				if (parentsParent.kind === ts.SyntaxKind.SourceFile)
					types.add(name);
			}
			else if (ts.isModuleDeclaration(parent)) {
				const name = parent.name.getText();

				const parentsParent = parent.parent;
				if (parentsParent.kind === ts.SyntaxKind.SourceFile)
					types.add(name);
			}
		}
	}

	ts.forEachChild(node, (n)=> nodeTraverser(source, n, exclusionTag, symbols, types));
};
