import { css } from 'lit';

export const forgeAppShellStyles = css`
	:host {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	* {
		box-sizing: border-box;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 24px;
		min-height: 56px;
		background: var(--bg-panel);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		z-index: 10;
	}
	.header-logo {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.header-logo svg {
		width: 24px;
		height: 24px;
		color: var(--accent);
	}
	.header-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		letter-spacing: -0.3px;
	}
	.header-project {
		font-size: 13px;
		color: var(--text-muted);
		padding: 3px 10px;
		background: var(--bg-badge);
		border-radius: 12px;
	}
	.header-nav {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.header-nav-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 12px;
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.header-nav-btn:hover {
		color: var(--text);
		border-color: var(--text-dim);
	}
	.header-nav-btn.active {
		color: var(--accent);
		border-color: var(--accent-dim);
		background: rgba(88, 166, 255, 0.1);
	}
	.header-refresh-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 12px;
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.header-refresh-btn:hover:not(:disabled) {
		color: var(--text);
		border-color: var(--text-dim);
	}
	.header-refresh-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.header-connection {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		font-size: 12px;
		color: var(--text-muted);
	}
	.header-connection-dot {
		display: inline-flex;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-dim);
	}
	.header-connection-dot.connected {
		background: var(--green);
	}
	.header-connection-dot.disconnected {
		background: var(--red);
	}
	.header-connection-dot.checking {
		background: var(--orange);
	}
	.header-active-path {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 220px;
		max-width: 420px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		font-size: 12px;
		color: var(--text-muted);
	}
	.header-active-path-label {
		font-size: 11px;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.4px;
		white-space: nowrap;
	}
	.header-active-path-value {
		font-family: var(--font-mono);
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.header-spacer {
		flex: 1;
	}
	.header-version {
		font-size: 12px;
		color: var(--text-dim);
		font-family: var(--font-mono);
	}

	.search-wrapper {
		position: relative;
		width: 280px;
	}
	.search-wrapper.hidden {
		visibility: hidden;
		pointer-events: none;
	}
	.search-wrapper svg {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 16px;
		height: 16px;
		color: var(--text-dim);
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding: 7px 12px 7px 34px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		font-size: 13px;
		font-family: var(--font-sans);
		outline: none;
		transition: border-color 0.15s;
	}
	.search-input::placeholder {
		color: var(--text-dim);
	}
	.search-input:focus {
		border-color: var(--accent);
	}

	.layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.layout.registry-view .sidebar {
		display: none;
	}

	.sidebar {
		width: 280px;
		flex-shrink: 0;
		background: var(--bg-panel);
		border-right: 1px solid var(--border);
	}

	.main {
		flex: 1;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 32px 48px;
	}

	.main::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}

	.main::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}

	.registry-main {
		padding: 0;
		overflow: hidden;
	}
`;
