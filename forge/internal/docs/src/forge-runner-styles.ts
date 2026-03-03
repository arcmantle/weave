import { css } from 'lit';

export const forgeRunnerStyles = css`
	:host {
		display: block;
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

	.runner-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.runner-field {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.runner-field label {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--accent);
		min-width: 120px;
		flex-shrink: 0;
	}

	.runner-field-meta {
		font-size: 11px;
		color: var(--text-dim);
		margin-left: 4px;
		font-family: var(--font-sans);
		font-weight: 400;
	}

	.runner-input {
		flex: 1;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 7px 12px;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 13px;
		outline: none;
		transition: border-color 0.15s;
	}

	.runner-input:focus {
		border-color: var(--accent);
	}

	.runner-input::placeholder {
		color: var(--text-dim);
	}

	.runner-checkbox-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.runner-checkbox {
		appearance: none;
		width: 16px;
		height: 16px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		cursor: pointer;
		position: relative;
	}

	.runner-checkbox:checked {
		background: var(--accent);
		border-color: var(--accent);
	}

	.runner-checkbox:checked::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 5px;
		width: 4px;
		height: 8px;
		border: solid var(--bg);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.runner-actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}

	.runner-btn {
		padding: 8px 20px;
		border-radius: var(--radius-sm);
		border: none;
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.runner-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.runner-btn-run {
		background: var(--green);
		color: var(--bg);
	}

	.runner-btn-run:hover:not(:disabled) {
		opacity: 0.85;
	}

	.runner-btn-stop {
		background: var(--red);
		color: #fff;
	}

	.runner-btn-stop:hover:not(:disabled) {
		opacity: 0.85;
	}

	.runner-btn-clear {
		background: var(--bg-badge);
		color: var(--text-muted);
	}

	.runner-btn-clear:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.runner-terminal {
		margin-top: 12px;
		background: #0d0d0d;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.runner-terminal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		background: var(--bg-card);
		border-bottom: 1px solid var(--border);
		font-size: 11px;
		color: var(--text-dim);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.runner-terminal-status {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.runner-terminal-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-dim);
	}

	.runner-terminal-dot.running {
		background: var(--green);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.runner-terminal-dot.exited-ok {
		background: var(--green);
	}

	.runner-terminal-dot.exited-err {
		background: var(--red);
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
