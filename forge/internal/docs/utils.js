// ─── Shared Type Definitions ───

/**
 * @typedef {Object} DocArg
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} [required]
 * @property {string} [defaultValue]
 */

/**
 * @typedef {Object} DocStep
 * @property {string} [command]
 * @property {string[]} [args]
 * @property {string[]} [parallel]
 */

/**
 * @typedef {Object} DocCommand
 * @property {string} name
 * @property {string} description
 * @property {'script' | 'composite'} commandType
 * @property {string} [source]
 * @property {string} [sourcePath]
 * @property {string} [script]
 * @property {string} [scriptPath]
 * @property {string} [language]
 * @property {string} [example]
 * @property {DocArg[]} [positionals]
 * @property {DocArg[]} [flags]
 * @property {DocStep[]} [steps]
 */

/**
 * @typedef {Object} DocData
 * @property {string} projectName
 * @property {string} version
 * @property {DocCommand[]} commands
 */

/**
 * @typedef {'pending' | 'compiling' | 'ready'} MetaStatusValue
 */

/**
 * @typedef {Record<string, MetaStatusValue>} MetaStatus
 */

/**
 * @typedef {Object} AnsiState
 * @property {boolean} bold
 * @property {boolean} dim
 * @property {boolean} italic
 * @property {boolean} underline
 * @property {string | null} fg
 * @property {string | null} bg
 */

/**
 * @typedef {Object} ParsedLine
 * @property {string} html
 */

/**
 * @typedef {Object} AnsiParseResult
 * @property {ParsedLine[]} lines
 * @property {string} trailing
 */


// ─── HTML Escaping ───

/**
 * Escape a string for safe HTML insertion.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
	if (!s) return '';
	const div = document.createElement('div');
	div.textContent = s;
	return div.innerHTML;
}

// ─── SVG Helpers ───

/** @returns {string} Chevron SVG markup for sidebar groups. */
function chevronSvg() {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
}

/** @returns {string} File icon SVG markup. */
function fileSvg() {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px">'
		+ '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
		+ '<polyline points="14 2 14 8 20 8"/></svg>';
}

/** @returns {string} Loading spinner SVG markup. */
function spinnerSvg() {
	return '<svg viewBox="0 0 16 16" style="width:12px;height:12px;animation:spin 0.8s linear infinite">'
		+ '<circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" stroke-width="2"/>'
		+ '<path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>';
}

/** @returns {string} Checkmark SVG markup. */
function checkSvg() {
	return '<svg viewBox="0 0 16 16" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px">'
		+ '<polyline points="3 8 7 12 13 4"/></svg>';
}

/** @returns {string} Play button SVG markup. */
function playSvg() {
	return '<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px"><polygon points="3,1 13,8 3,15"/></svg>';
}

/** @returns {string} Stop button SVG markup. */
function stopSvg() {
	return '<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>';
}

/** @returns {string} External link icon SVG markup. */
function linkSvg() {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px">'
		+ '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
		+ '<polyline points="15 3 21 3 21 9"/>'
		+ '<line x1="10" y1="14" x2="21" y2="3"/></svg>';
}

/**
 * Create a VS Code file:// deep link URL from a file path.
 * @param {string} path - Absolute file path.
 * @returns {string} The vscode://file/ URL, or empty string if path is empty.
 */
function vscodeFileUrl(path) {
	if (!path) return '';
	return 'vscode://file/' + encodeURI(path.replace(/\\/g, '/'));
}
