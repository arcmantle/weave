import { css } from 'lit';

export const forgeTerminalStyles = css`
	:host {
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.6;
		color: #cccccc;
		display: block;
		height: 400px;
		overflow: auto;
		tab-size: 4;
		position: relative;
	}

	.runner-terminal-viewport {
		padding: 0 16px;
	}

	.runner-terminal-line {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
	}
`;
