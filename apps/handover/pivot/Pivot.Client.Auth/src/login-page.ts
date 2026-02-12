import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { authService } from './auth-service.js';


@customElement('login-page')
export class LoginPage extends LitElement {

	@state() protected username = '';
	@state() protected errorMessage = '';
	@state() protected isLoggingIn = false;

	/** Override this to change the title displayed on the login form. */
	protected pageTitle: string = 'Pivot Login';

	/** Override this to change the subtitle displayed on the login form. */
	protected subtitle: string = 'Enter your username to continue';

	/** Override this to change the post-login redirect path. */
	protected redirectPath: string = '/';

	protected async handleLogin(): Promise<void> {
		this.errorMessage = '';

		if (!this.username.trim()) {
			this.errorMessage = 'Please enter a username';

			return;
		}

		try {
			this.isLoggingIn = true;
			const result = await authService.login(this.username.trim());

			if (result.success)
				await router.navigate(this.redirectPath);

			else
				this.errorMessage = result.error ?? 'Login failed';
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
				<h1>${ this.pageTitle }</h1>
				<p class="login-subtitle">${ this.subtitle }</p>

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
						${ when(this.isLoggingIn, () => 'Logging in...', () => 'Login') }
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
			--color-primary-alt: #764ba2;
			--color-text: #333;
			--color-text-muted: #666;
			--color-danger: #c33;
			--color-danger-bg: #fee;
			--color-danger-border: #fcc;
			--color-border: #ddd;
			--font-size-sm: 14px;
			--font-size-md: 16px;
			--font-size-lg: 28px;
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 20px;
			--spacing-xl: 30px;
			--spacing-2xl: 40px;
			--radius: 4px;
			--radius-lg: 8px;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-alt) 100%);
		}
		.login-container {
			width: 100%;
			max-width: 400px;
			padding: var(--spacing-lg);
		}
		.login-box {
			padding: var(--spacing-2xl);
			background: white;
			border-radius: var(--radius-lg);
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
			color: var(--color-text-muted);
			text-align: center;
		}
		.alert {
			padding: var(--spacing-md);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius);
		}
		.alert-danger {
			background-color: var(--color-danger-bg);
			color: var(--color-danger);
			border: 1px solid var(--color-danger-border);
		}
		.form-group {
			margin-bottom: var(--spacing-lg);

			label {
				display: block;
				margin-bottom: var(--spacing-sm);
				font-weight: 500;
				color: var(--color-text);
			}
		}
		.form-control {
			width: 100%;
			padding: var(--spacing-md);
			border: 1px solid var(--color-border);
			border-radius: var(--radius);
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
			border-radius: var(--radius);
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
			background-color: var(--color-primary);
			color: white;

			&:hover:not(:disabled) {
				background-color: var(--color-primary-hover);
			}
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'login-page': LoginPage;
	}
}
