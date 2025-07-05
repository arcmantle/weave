import { promises } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';


export const exists = async (path: string): Promise<boolean> => {
	let exists = false;

	await access(path)
		.then(() => exists = true)
		.catch(() => exists = false);

	return exists;
};


/**
 * Async generator for retrieving file paths matching a `pattern` in a `directory` using Node.JS.
 * Includes sub folders.
 */
export async function* getFiles(
	directory: string,
	pattern?: RegExp,
): AsyncGenerator<string, void, string | undefined> {
	const entries = await promises.readdir(directory, { withFileTypes: true });
	for (const dirent of entries) {
		const res = path.resolve(directory, dirent.name);
		if (dirent.isDirectory())
			yield* getFiles(res, pattern);
		else if (pattern?.test(res) ?? true)
			yield res;
	}
}


/**
 * Convert a `generated` async iterable to an array promise.
 */
export async function genToArray<T>(generated: AsyncIterable<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const x of generated)
		out.push(x);

	return out;
}
