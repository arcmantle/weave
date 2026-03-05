import { css } from 'lit';

export const forgeTemplatesStyles = css`
	:host {
		display: block;
	}

	.command-detail {
		padding-bottom: 24px;
		max-width: 720px;
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

	.usage-optional {
		color: var(--text-dim);
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

	.template-install-log-wrap {
		margin-top: 6px;
	}

	.template-install-log-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.template-install-log-toggle,
	.template-install-log-copy {
		padding: 0;
		background: none;
		border: 0;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.template-install-log-toggle {
		color: var(--accent);
	}

	.template-install-log-toggle:hover {
		text-decoration: underline;
	}

	.template-install-log-copy {
		color: var(--text-dim);
	}

	.template-install-log-copy:hover {
		color: var(--text);
	}

	.template-install-output {
		margin-top: 10px;
		padding: 10px 12px;
		background: #0d0d0d;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: #cccccc;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 220px;
		overflow: auto;
	}

	.template-languages {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.template-lang-chip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.template-lang-name {
		font-weight: 600;
		font-size: 13px;
	}

	.template-lang-flag {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}

	.template-examples {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.template-example {
		padding: 10px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.template-example code {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--cyan);
	}

	.template-versions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.template-version-item {
		padding: 8px 12px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}

	.template-version-item code {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}
`;
