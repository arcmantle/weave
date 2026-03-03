import { css } from 'lit';

export const forgeSidebarStyles = css`
	:host {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	* {
		box-sizing: border-box;
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: 8px;
	}

	.sidebar-content::-webkit-scrollbar {
		width: 6px;
	}

	.sidebar-content::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}

	.sidebar-group {
		margin-bottom: 4px;
	}

	.sidebar-group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		cursor: pointer;
		user-select: none;
		border-radius: var(--radius-sm);
		transition: color 0.15s;
	}

	.sidebar-group-header:hover {
		color: var(--text-muted);
	}

	.sidebar-group-header svg {
		width: 12px;
		height: 12px;
		transition: transform 0.15s;
	}

	.sidebar-group-header.collapsed svg {
		transform: rotate(-90deg);
	}

	.sidebar-group-items {
		overflow: hidden;
	}

	.sidebar-group-items.collapsed {
		display: none;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px 6px 20px;
		font-size: 13px;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sidebar-item.top-level {
		padding-left: 10px;
	}

	.sidebar-item:hover {
		background: var(--bg-hover);
		color: var(--text);
	}

	.sidebar-item.active {
		background: var(--accent-dim);
		color: var(--accent);
	}

	.sidebar-item .badge {
		margin-left: auto;
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		font-weight: 500;
		flex-shrink: 0;
	}

	.badge-script {
		background: rgba(86, 211, 100, 0.15);
		color: var(--green);
	}

	.badge-composite {
		background: rgba(188, 140, 255, 0.15);
		color: var(--purple);
	}

	.badge-template {
		background: rgba(57, 210, 192, 0.15);
		color: var(--cyan);
	}

	.sidebar-stats {
		padding: 12px 16px;
		border-top: 1px solid var(--border);
		font-size: 12px;
		color: var(--text-dim);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.sidebar-stats-main {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		min-width: 0;
	}

	.sidebar-stats-action {
		margin-left: auto;
		flex-shrink: 0;
	}

	.sidebar-stats span {
		color: var(--text-muted);
	}

	.stats-sep {
		width: 1px;
		height: 10px;
		background: var(--border);
		flex-shrink: 0;
	}

	.sidebar-toggle-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
		font-size: 11px;
		color: var(--text-dim);
		cursor: pointer;
		font-family: var(--font-sans);
		transition: color 0.15s, border-color 0.15s;
	}

	.sidebar-toggle-btn:hover {
		color: var(--text-muted);
		border-color: var(--text-dim);
	}

	.inherited-group,
	.template-group {
		margin-top: 4px;
		border-top: 1px solid var(--border);
	}

	.inherited-group-header,
	.template-group-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		user-select: none;
		list-style: none;
		border-radius: var(--radius-sm);
		transition: color 0.15s;
	}

	.inherited-group-header {
		color: var(--orange);
	}

	.template-group-header {
		color: var(--cyan);
	}

	.inherited-group-header::-webkit-details-marker,
	.template-group-header::-webkit-details-marker {
		display: none;
	}

	.inherited-group-header:hover,
	.template-group-header:hover {
		color: var(--text);
	}

	.inherited-group-header > svg:first-child,
	.template-group-header > svg:first-child {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		transition: transform 0.15s;
		transform: rotate(-90deg);
	}

	.inherited-group[open] > .inherited-group-header > svg:first-child,
	.template-group[open] > .template-group-header > svg:first-child {
		transform: rotate(0);
	}

	.inherited-group-name,
	.template-group-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.inherited-count,
	.template-count {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.inherited-count {
		background: rgba(210, 153, 34, 0.12);
		color: var(--orange);
	}

	.template-count {
		background: rgba(57, 210, 192, 0.12);
		color: var(--cyan);
	}

	.inherited-source-link {
		display: inline-flex;
		align-items: center;
		color: var(--text-dim);
		flex-shrink: 0;
		transition: color 0.15s;
	}

	.inherited-source-link:hover {
		color: var(--accent);
	}

	.inherited-group-items,
	.template-group-items {
		padding-bottom: 4px;
	}

	.no-results {
		text-align: center;
		padding: 48px 24px;
		color: var(--text-dim);
	}

	.no-results p {
		margin-top: 8px;
		font-size: 14px;
	}

	.status-icon {
		display: inline-flex;
		align-items: center;
		margin-right: 4px;
		flex-shrink: 0;
	}

	.status-icon.compiling svg {
		display: block;
	}

	.status-loading {
		color: var(--accent);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}

		50% {
			opacity: 0.5;
		}
	}
`;
