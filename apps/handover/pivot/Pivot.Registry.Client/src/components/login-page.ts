import { authService } from '@arcmantle/pivot-client-auth';
import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

@customElement('login-page')
export class LoginPage extends LitElement {

	@state() protected username = '';
	@state() protected errorMessage = '';
	@state() protected isLoggingIn = false;

	protected async handleLogin(): Promise<void> {
		this.errorMessage = '';

		if (!this.username.trim()) {
			this.errorMessage = 'Please enter a username';

			return;
		}

		try {
			this.isLoggingIn = true;
			const result = await authService.login(this.username.trim());

			if (result.success) {
				// Navigate to dashboard
				await router.navigate('/');
			}
			else {
				this.errorMessage = result.error ?? 'Login failed';
			}
		}
		catch (err) {
			this.errorMessage = `Login failed: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.isLoggingIn = false;
		}
	}

	protected handleKeyPress(e: KeyboardEvent): void {
		if (e.key === 'Enter')
			this.handleLogin();
	}

	protected handleUsernameInput(e: Event): void {
		this.username = (e.target as HTMLInputElement).value;
	}

	override render(): unknown {
		return html`
		<div class="login-container">
			<div class="login-box">
				<h1>Pivot Registry Login</h1>
				<p class="login-subtitle">Enter your username to continue</p>

				${ when(this.errorMessage, () => html`
				<div class="alert alert-danger">${ this.errorMessage }</div>
				`) }

				<div class="login-form">
					<div class="form-group">
						<label for="username">Username</label>
						<input
							id="username"
							type="text"
							class="form-control"
							.value=${ this.username }
							@input=${ this.handleUsernameInput }
							@keypress=${ this.handleKeyPress }
							placeholder="Enter your username"
							autofocus
						/>
					</div>

					<button
						class="btn btn-primary"
						@click=${ this.handleLogin }
						?disabled=${ this.isLoggingIn }
					>
						${ this.isLoggingIn ? 'Logging in...' : 'Login' }
					</button>
				</div>
			</div>
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-text: #333;
			--color-muted: #666;
			--color-danger-bg: #fee;
			--color-danger-text: #c33;
			--color-danger-border: #fcc;
			--color-input-border: #ddd;
			--font-size-sm: 14px;
			--font-size-md: 16px;
			--font-size-lg: 28px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 20px;
			--spacing-xl: 30px;
			--spacing-2xl: 40px;
			--radius-sm: 4px;
			--radius-md: 8px;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: linear-gradient(135deg, var(--color-primary) 0%, #764ba2 100%);
		}
		.login-container {
			width: 100%;
			max-width: 400px;
			padding: var(--spacing-lg);
		}
		.login-box {
			padding: var(--spacing-2xl);
			border-radius: var(--radius-md);
			background: white;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
		}
		h1 {
			margin: 0 0 10px 0;
			font-size: var(--font-size-lg);
			color: var(--color-text);
			text-align: center;
		}
		.login-subtitle {
			margin-bottom: var(--spacing-xl);
			font-size: var(--font-size-sm);
			color: var(--color-muted);
			text-align: center;
		}
		.alert {
			padding: var(--spacing-md);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius-sm);
		}
		.alert-danger {
			border: 1px solid var(--color-danger-border);
			background: var(--color-danger-bg);
			color: var(--color-danger-text);
		}
		.form-group {
			margin-bottom: var(--spacing-lg);

			& label {
				display: block;
				margin-bottom: var(--spacing-sm);
				font-weight: 500;
				color: var(--color-text);
			}
		}
		.form-control {
			width: 100%;
			padding: var(--spacing-md);
			border: 1px solid var(--color-input-border);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-sm);
			box-sizing: border-box;
			transition: border-color 0.3s;

			&:focus {
				border-color: var(--color-primary);
				outline: none;
			}
		}
		.btn {
			width: 100%;
			padding: var(--spacing-md);
			border: none;
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
			font-weight: 500;
			cursor: pointer;
			transition: background-color 0.3s;

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;

			&:hover:not(:disabled) { background: var(--color-primary-hover); }
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'login-page': LoginPage;
	}
}
