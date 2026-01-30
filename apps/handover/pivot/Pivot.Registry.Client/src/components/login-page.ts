import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { authService } from '../services/auth-service.ts';

@customElement('login-page')
export class LoginPage extends LitElement {

	@state() private username = '';
	@state() private errorMessage = '';
	@state() private isLoggingIn = false;

	private async handleLogin() {
		this.errorMessage = '';

		if (!this.username.trim()) {
			this.errorMessage = 'Please enter a username';

			return;
		}

		try {
			this.isLoggingIn = true;
			const result = await authService.login(this.username.trim());

			if (result.success) {
				// Trigger navigation via custom event
				this.dispatchEvent(new CustomEvent('login-success', { bubbles: true, composed: true }));
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

	private handleKeyPress(e: KeyboardEvent): void {
		if (e.key === 'Enter')
			this.handleLogin();
	}

	override render(): unknown {
		return html`
			<div class="login-container">
				<div class="login-box">
					<h1>Pivot Registry Login</h1>
					<p class="login-subtitle">Enter your username to continue</p>

					${ this.errorMessage
						? html`<div class="alert alert-danger">${ this.errorMessage }</div>`
						: '' }

					<div class="login-form">
						<div class="form-group">
							<label for="username">Username</label>
							<input
								id="username"
								type="text"
								class="form-control"
								.value=${ this.username }
								@input=${ (e: Event) => {
									this.username = (e.target as HTMLInputElement).value;
								} }
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
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		}

		.login-container {
			width: 100%;
			max-width: 400px;
			padding: 20px;
		}

		.login-box {
			background: white;
			border-radius: 8px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
			padding: 40px;
		}

		h1 {
			margin: 0 0 10px 0;
			color: #333;
			font-size: 28px;
			text-align: center;
		}

		.login-subtitle {
			color: #666;
			text-align: center;
			margin-bottom: 30px;
			font-size: 14px;
		}

		.alert {
			padding: 12px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-danger {
			background-color: #fee;
			color: #c33;
			border: 1px solid #fcc;
		}

		.form-group {
			margin-bottom: 20px;
		}

		label {
			display: block;
			margin-bottom: 8px;
			color: #333;
			font-weight: 500;
		}

		.form-control {
			width: 100%;
			padding: 12px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			box-sizing: border-box;
			transition: border-color 0.3s;
		}

		.form-control:focus {
			outline: none;
			border-color: #667eea;
		}

		.btn {
			width: 100%;
			padding: 12px;
			border: none;
			border-radius: 4px;
			font-size: 16px;
			font-weight: 500;
			cursor: pointer;
			transition: background-color 0.3s;
		}

		.btn-primary {
			background-color: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background-color: #5568d3;
		}

		.btn:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'login-page': LoginPage;
	}
}
