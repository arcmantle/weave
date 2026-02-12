import { Marked } from 'marked';
import markedShiki from 'marked-shiki';
import { createHighlighter } from 'shiki';


let markedInstance: Marked | undefined;

/**
 * Returns a configured Marked instance with Shiki syntax highlighting
 * for C# and TypeScript. The highlighter is lazily created on first call.
 */
export async function getMarked(): Promise<Marked> {
	if (markedInstance)
		return markedInstance;

	const highlighter = await createHighlighter({
		themes: [ 'plastic' ],
		langs:  [ 'csharp', 'typescript' ],
	});

	markedInstance = new Marked().use(
		markedShiki({
			highlight(code, lang) {
				const resolved = highlighter.getLoadedLanguages().includes(lang)
					? lang
					: 'text';

				return highlighter.codeToHtml(code, {
					lang:  resolved,
					theme: 'plastic',
				});
			},
		}),
	);

	return markedInstance;
}
