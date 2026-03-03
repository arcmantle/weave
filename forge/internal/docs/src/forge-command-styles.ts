import { css } from 'lit';

export const forgeCommandStyles = css`
	:host {
		display: block;
	}

	.welcome {
		max-width: 640px;
		margin: 0 auto;
		padding-top: 80px;
		text-align: center;
	}

	.welcome h1 {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 12px;
		letter-spacing: -0.5px;
	}

	.welcome p {
		font-size: 15px;
		color: var(--text-muted);
		line-height: 1.6;
		margin-bottom: 32px;
	}

	.welcome-stats {
		display: flex;
		justify-content: center;
		gap: 32px;
	}

	.welcome-stat {
		text-align: center;
	}

	.welcome-stat .number {
		font-size: 32px;
		font-weight: 700;
		color: var(--accent);
	}

	.welcome-stat .label {
		font-size: 12px;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 4px;
	}

	.welcome-hint {
		margin-top: 48px;
		font-size: 13px;
		color: var(--text-dim);
	}

	.welcome-hint kbd {
		font-family: var(--font-mono);
		font-size: 12px;
		padding: 2px 6px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
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

	.badge {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		font-weight: 500;
	}

	.badge-script {
		background: rgba(86, 211, 100, 0.15);
		color: var(--green);
	}

	.badge-composite {
		background: rgba(188, 140, 255, 0.15);
		color: var(--purple);
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

	.meta-chip svg {
		width: 14px;
		height: 14px;
	}

	a.meta-chip-link {
		text-decoration: none;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	a.meta-chip-link:hover {
		border-color: var(--accent);
		background: var(--bg-hover);
	}

	.meta-chip-local {
		background: rgba(86, 211, 100, 0.12);
		color: var(--green);
		border-color: rgba(86, 211, 100, 0.25);
	}

	.meta-chip-inherited {
		background: rgba(210, 153, 34, 0.12);
		color: var(--orange);
		border-color: rgba(210, 153, 34, 0.25);
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

	.arg-type {
		font-family: var(--font-mono);
		font-size: 12px;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.type-string {
		background: rgba(57, 210, 192, 0.12);
		color: var(--cyan);
	}

	.type-bool {
		background: rgba(210, 153, 34, 0.12);
		color: var(--orange);
	}

	.arg-required {
		font-size: 11px;
		color: var(--red);
		font-weight: 500;
	}

	.arg-default {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}

	.steps-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition: background 0.1s;
	}

	.step:hover {
		background: var(--bg-hover);
	}

	.step-index {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		width: 20px;
		text-align: center;
		flex-shrink: 0;
	}

	.step-arrow {
		color: var(--text-dim);
		flex-shrink: 0;
	}

	.step-name,
	.parallel-entry {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--accent);
		cursor: pointer;
	}

	.step-name:hover,
	.parallel-entry:hover {
		text-decoration: underline;
	}

	.step-args {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-dim);
	}

	.step-parallel-badge {
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 8px;
		background: rgba(188, 140, 255, 0.15);
		color: var(--purple);
		font-weight: 600;
		white-space: nowrap;
	}

	.parallel-entries {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.parallel-separator {
		color: var(--text-dim);
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

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.meta-loading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-dim);
		font-size: 13px;
		padding: 12px 0;
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

	.example-content ul {
		margin: 8px 0;
		padding-left: 20px;
	}

	.example-content li {
		margin: 4px 0;
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

	.example-content :not(pre) > code {
		background: var(--bg-card);
		padding: 2px 6px;
		border-radius: 3px;
		color: var(--accent);
	}

	.example-content strong {
		font-weight: 600;
		color: var(--text);
	}

	.example-content em {
		font-style: italic;
		color: var(--text-muted);
	}

	.example-content a {
		color: var(--accent);
		text-decoration: none;
	}

	.example-content a:hover {
		text-decoration: underline;
	}
`;
