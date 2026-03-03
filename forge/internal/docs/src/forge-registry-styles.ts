import { css } from 'lit';

export const forgeRegistryStyles = css`
	:host {
		display: block;
		height: 100%;
	}

	.registry-shell {
		display: grid;
		grid-template-columns: minmax(420px, 1fr) minmax(460px, 1.5fr);
		gap: 0;
		height: 100%;
	}

	.registry-list-panel,
	.registry-detail-panel {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.registry-list-panel {
		border-right: 1px solid var(--border);
	}

	.registry-detail-panel {
		background: var(--bg);
		border-left: 0;
		border-right: 0;
	}

	.registry-toolbar {
		display: flex;
		gap: 10px;
		padding: 12px;
		border-bottom: 1px solid var(--border);
		align-items: center;
	}

	.registry-search {
		flex: 1;
		padding: 8px 10px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0;
		color: var(--text);
		font-size: 13px;
	}

	.registry-source {
		min-width: 180px;
		padding: 8px 10px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0;
		color: var(--text);
		font-size: 13px;
	}

	.registry-results {
		flex: 1;
		overflow: auto;
		scrollbar-gutter: stable;
		padding: 0;
	}

	.registry-item {
		padding: 10px;
		border: 1px solid transparent;
		border-radius: 0;
		cursor: pointer;
		margin: 0;
		border-bottom: 1px solid var(--border);
		background: var(--bg-card);
		transition: border-color 0.15s, background 0.15s;
	}

	.registry-item:hover {
		border-color: var(--border);
		background: var(--bg-hover);
	}

	.registry-item.active {
		border-color: var(--accent-dim);
		background: rgba(88, 166, 255, 0.1);
	}

	.registry-item-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}

	.registry-item-meta {
		display: flex;
		gap: 8px;
		margin-top: 6px;
		font-size: 11px;
		color: var(--text-dim);
		flex-wrap: wrap;
	}

	.registry-item-desc {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.registry-list-footer {
		padding: 10px 12px;
		border-top: 1px solid var(--border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: var(--text-dim);
	}

	.registry-load-more {
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 6px 10px;
		border-radius: 0;
		cursor: pointer;
	}

	.registry-load-more:hover {
		color: var(--text);
		border-color: var(--text-dim);
	}

	.registry-detail-scroll {
		flex: 1;
		overflow: auto;
		scrollbar-gutter: stable;
		padding: 12px 16px;
	}

	.registry-empty {
		padding: 12px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.registry-results::-webkit-scrollbar,
	.registry-detail-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.registry-results::-webkit-scrollbar-thumb,
	.registry-detail-scroll::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 4px;
	}

	.command-detail {
		padding-bottom: 24px;
		max-width: none;
	}

	.command-header {
		margin-bottom: 24px;
	}

	.command-name {
		font-size: 24px;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: -0.5px;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.command-description {
		font-size: 15px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.command-meta {
		display: flex;
		gap: 12px;
		margin-top: 12px;
		flex-wrap: wrap;
	}

	.badge-template {
		background: rgba(57, 210, 192, 0.15);
		color: var(--cyan);
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		font-weight: 500;
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		padding: 4px 10px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.meta-chip-template {
		background: rgba(57, 210, 192, 0.12);
		color: var(--cyan);
		border-color: rgba(57, 210, 192, 0.25);
	}

	.section {
		margin-top: 28px;
	}

	.section-title {
		font-size: 13px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}

	.usage-box {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 14px 18px;
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--cyan);
		overflow-x: auto;
	}

	.usage-prefix {
		color: var(--text-dim);
		margin-right: 4px;
	}

	.usage-required {
		color: var(--orange);
	}

	.usage-template-name {
		color: var(--cyan);
	}

	.arg-table {
		width: 100%;
		border-collapse: collapse;
	}

	.arg-table th {
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}

	.arg-table td {
		padding: 10px 12px;
		font-size: 13px;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}

	.arg-table tr:last-child td {
		border-bottom: none;
	}

	.arg-table tr:hover td {
		background: var(--bg-hover);
	}

	.arg-name {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent);
		white-space: nowrap;
	}

	.arg-default {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}

	.template-install {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.template-install-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		color: var(--text-dim);
	}

	.template-install-input,
	.template-install-select {
		padding: 8px 10px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 13px;
		outline: none;
		transition: border-color 0.15s;
	}

	.template-install-input:focus,
	.template-install-select:focus {
		border-color: var(--accent);
	}

	.template-install-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.template-install-btn {
		padding: 8px 12px;
		background: var(--accent-dim);
		border: 1px solid var(--accent);
		border-radius: var(--radius-sm);
		color: var(--accent);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.template-install-btn:hover {
		opacity: 0.9;
	}

	.template-install-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.template-install-status {
		font-size: 12px;
		color: var(--text-dim);
	}

	.template-install-status.success {
		color: var(--green);
	}

	.template-install-status.error {
		color: var(--red);
	}

	.example-content {
		font-size: 14px;
		line-height: 1.7;
		color: var(--text);
	}

	.example-content h1,
	.example-content h2,
	.example-content h3,
	.example-content h4 {
		margin: 16px 0 8px;
		color: var(--text);
		font-weight: 600;
	}

	.example-content h1 {
		font-size: 18px;
	}

	.example-content h2 {
		font-size: 16px;
	}

	.example-content h3 {
		font-size: 14px;
	}

	.example-content p {
		margin: 8px 0;
	}

	.example-content pre {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 12px 16px;
		margin: 8px 0;
		overflow-x: auto;
	}

	.example-content code {
		font-family: var(--font-mono);
		font-size: 13px;
	}
`;
