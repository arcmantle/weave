function esc(value: string): string {
	if (!value) {
		return '';
	}

	const div = document.createElement('div');
	div.textContent = value;
	return div.innerHTML;
}

function chevronSvg(): string {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
}

function fileSvg(): string {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px">'
		+ '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
		+ '<polyline points="14 2 14 8 20 8"/></svg>';
}

function spinnerSvg(): string {
	return '<svg viewBox="0 0 16 16" style="width:12px;height:12px;animation:spin 0.8s linear infinite">'
		+ '<circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" stroke-width="2"/>'
		+ '<path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>';
}

function checkSvg(): string {
	return '<svg viewBox="0 0 16 16" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px">'
		+ '<polyline points="3 8 7 12 13 4"/></svg>';
}

function playSvg(): string {
	return '<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px"><polygon points="3,1 13,8 3,15"/></svg>';
}

function stopSvg(): string {
	return '<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>';
}

function linkSvg(): string {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px">'
		+ '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
		+ '<polyline points="15 3 21 3 21 9"/>'
		+ '<line x1="10" y1="14" x2="21" y2="3"/></svg>';
}

function vscodeFileUrl(path: string): string {
	if (!path) {
		return '';
	}

	return 'vscode://file/' + encodeURI(path.replace(/\\/g, '/'));
}

const docsGlobals = globalThis as typeof globalThis & {
	esc?: typeof esc;
	chevronSvg?: typeof chevronSvg;
	fileSvg?: typeof fileSvg;
	spinnerSvg?: typeof spinnerSvg;
	checkSvg?: typeof checkSvg;
	playSvg?: typeof playSvg;
	stopSvg?: typeof stopSvg;
	linkSvg?: typeof linkSvg;
	vscodeFileUrl?: typeof vscodeFileUrl;
};

docsGlobals.esc = esc;
docsGlobals.chevronSvg = chevronSvg;
docsGlobals.fileSvg = fileSvg;
docsGlobals.spinnerSvg = spinnerSvg;
docsGlobals.checkSvg = checkSvg;
docsGlobals.playSvg = playSvg;
docsGlobals.stopSvg = stopSvg;
docsGlobals.linkSvg = linkSvg;
docsGlobals.vscodeFileUrl = vscodeFileUrl;
