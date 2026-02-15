import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';


interface User {
	id:        number;
	username:  string;
	email:     string;
	createdAt: string;
}


/**
 * Users management page component.
 * Fetches and displays users from the UsersPlugin API,
 * and provides a form to create new users.
 */
@customElement('users-page')
export class UsersPage extends LitElement {

	@state() protected users: User[] = [];
	@state() protected loading = true;
	@state() protected error: string | undefined;
	@state() protected username = '';
	@state() protected email    = '';
	@state() protected creating = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadUsers();
	}

	protected async loadUsers(): Promise<void> {
		try {
			this.loading = true;
			this.error = undefined;

			const response = await fetch('/api/users');
			if (!response.ok)
				throw new Error(`HTTP ${ response.status }: ${ response.statusText }`);

			this.users = await response.json();
		}
		catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
		finally {
			this.loading = false;
		}
	}

	protected handleRefresh(e: Event): void {
		e.preventDefault();
		this.loadUsers();
	}

	protected handleInput(e: InputEvent): void {
		const target = e.target as HTMLInputElement;
		if (target.name === 'username')
			this.username = target.value;
		else if (target.name === 'email')
			this.email = target.value;
	}

	protected async handleCreate(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!this.username.trim() || !this.email.trim())
			return;

		try {
			this.creating = true;
			const response = await fetch(
				`/api/users?username=${ encodeURIComponent(this.username) }&email=${ encodeURIComponent(this.email) }`,
				{ method: 'POST' },
			);

			if (!response.ok)
				throw new Error(`HTTP ${ response.status }: ${ response.statusText }`);

			this.username = '';
			this.email = '';
			await this.loadUsers();
		}
		catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
		finally {
			this.creating = false;
		}
	}

	override render(): unknown {
		return html`
		<div class="users-page">
			<header>
				<h1>👥 Users</h1>
				<button @click=${ this.handleRefresh } ?disabled=${ this.loading }>
					${ when(this.loading,
						() => html`Loading...`,
						() => html`Refresh`) }
				</button>
			</header>

			<form class="create-form" @submit=${ this.handleCreate }>
				<input
					type="text"
					name="username"
					placeholder="Username"
					.value=${ this.username }
					@input=${ this.handleInput }
					?disabled=${ this.creating }
				/>
				<input
					type="email"
					name="email"
					placeholder="Email"
					.value=${ this.email }
					@input=${ this.handleInput }
					?disabled=${ this.creating }
				/>
				<button type="submit" ?disabled=${ this.creating || !this.username.trim() || !this.email.trim() }>
					${ when(this.creating,
						() => html`Creating...`,
						() => html`Add User`) }
				</button>
			</form>

			${ when(this.error,
				() => html`
				<div class="error">
					<p>Error: ${ this.error }</p>
				</div>
				`) }

			${ when(!this.loading && !this.error,
				() => html`
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Username</th>
							<th>Email</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						${ map(this.users, user => html`
						<tr>
							<td>${ user.id }</td>
							<td>${ user.username }</td>
							<td>${ user.email }</td>
							<td>${ new Date(user.createdAt).toLocaleDateString() }</td>
						</tr>
						`) }
					</tbody>
				</table>
				`) }
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
		}
		.users-page {
			max-width: 900px;
		}
		header {
			display: flex;
			align-items: center;
			gap: 1rem;
			margin-bottom: 1.5rem;
		}
		header h1 {
			margin: 0;
			font-size: 1.5rem;
		}
		.create-form {
			display: flex;
			gap: 0.5rem;
			margin-bottom: 1.5rem;
		}
		input {
			padding: 0.4rem 0.75rem;
			border: 1px solid var(--border, #45475a);
			border-radius: 6px;
			background: var(--input-bg, #313244);
			color: var(--input-fg, #cdd6f4);
			font: inherit;
		}
		input::placeholder {
			color: var(--placeholder, #6c7086);
		}
		button {
			padding: 0.4rem 1rem;
			border: 1px solid var(--border, #45475a);
			border-radius: 6px;
			background: var(--button-bg, #313244);
			color: var(--button-fg, #cdd6f4);
			cursor: pointer;
			transition: background 0.15s;
		}
		button:hover:not(:disabled) {
			background: var(--button-hover, #45475a);
		}
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		table {
			width: 100%;
			border-collapse: collapse;
		}
		th, td {
			padding: 0.5rem 0.75rem;
			border-bottom: 1px solid var(--border, #45475a);
			text-align: left;
		}
		th {
			font-weight: 600;
			color: var(--header-fg, #a6adc8);
			font-size: 0.85rem;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.error {
			padding: 1rem;
			border: 1px solid var(--error-border, #f38ba8);
			border-radius: 8px;
			background: var(--error-bg, #302030);
			color: var(--error-fg, #f38ba8);
			margin-bottom: 1rem;
		}
	`;

}
