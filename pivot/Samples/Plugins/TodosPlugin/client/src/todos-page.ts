import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';


interface TodoItem {
	id:               number;
	title:            string;
	isCompleted:      boolean;
	assignedToUserId: number | null;
	createdAt:        string;
}

interface User {
	id:       number;
	username: string;
}


/**
 * Todos management page component.
 * Fetches and displays todos from the TodosPlugin API,
 * with user assignment via the UsersPlugin API.
 */
@customElement('todos-page')
export class TodosPage extends LitElement {

	@state() protected todos: TodoItem[] = [];
	@state() protected users: User[] = [];
	@state() protected loading = true;
	@state() protected error: string | undefined;
	@state() protected pageTitle    = '';
	@state() protected userId   = '';
	@state() protected creating = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadData();
	}

	protected async loadData(): Promise<void> {
		try {
			this.loading = true;
			this.error = undefined;

			const [ todosRes, usersRes ] = await Promise.all([
				fetch('/api/todos'),
				fetch('/api/users'),
			]);

			if (!todosRes.ok)
				throw new Error(`Todos: HTTP ${ todosRes.status }`);
			if (!usersRes.ok)
				throw new Error(`Users: HTTP ${ usersRes.status }`);

			this.todos = await todosRes.json();
			this.users = await usersRes.json();
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
		this.loadData();
	}

	protected handleInput(e: InputEvent): void {
		const target = e.target as HTMLInputElement | HTMLSelectElement;
		if (target.name === 'title')
			this.pageTitle = target.value;
		else if (target.name === 'userId')
			this.userId = target.value;
	}

	protected async handleCreate(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!this.pageTitle.trim())
			return;

		try {
			this.creating = true;
			const params = new URLSearchParams({ title: this.pageTitle });
			if (this.userId)
				params.set('assignedToUserId', this.userId);

			const response = await fetch(`/api/todos?${ params }`, { method: 'POST' });
			if (!response.ok)
				throw new Error(`HTTP ${ response.status }: ${ response.statusText }`);

			this.pageTitle = '';
			this.userId = '';
			await this.loadData();
		}
		catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		}
		finally {
			this.creating = false;
		}
	}

	protected getUserName(userId: number | null): string {
		if (userId === null)
			return '—';

		return this.users.find(u => u.id === userId)?.username ?? `User #${ userId }`;
	}

	override render(): unknown {
		return html`
		<div class="todos-page">
			<header>
				<h1>✅ Todos</h1>
				<button @click=${ this.handleRefresh } ?disabled=${ this.loading }>
					${ when(this.loading,
						() => html`Loading...`,
						() => html`Refresh`) }
				</button>
			</header>

			<form class="create-form" @submit=${ this.handleCreate }>
				<input
					type="text"
					name="title"
					placeholder="New todo..."
					.value=${ this.pageTitle }
					@input=${ this.handleInput }
					?disabled=${ this.creating }
				/>
				<select name="userId" @change=${ this.handleInput } ?disabled=${ this.creating }>
					<option value="">Unassigned</option>
					${ map(this.users, user => html`
					<option value=${ user.id }>${ user.username }</option>
					`) }
				</select>
				<button type="submit" ?disabled=${ this.creating || !this.pageTitle.trim() }>
					${ when(this.creating,
						() => html`Adding...`,
						() => html`Add Todo`) }
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
				${ when(this.todos.length === 0,
					() => html`<p class="empty">No todos yet. Create one above!</p>`,
					() => html`
					<table>
						<thead>
							<tr>
								<th>ID</th>
								<th>Title</th>
								<th>Status</th>
								<th>Assigned To</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							${ map(this.todos, todo => html`
							<tr class=${ todo.isCompleted ? 'completed' : '' }>
								<td>${ todo.id }</td>
								<td>${ todo.title }</td>
								<td>${ todo.isCompleted ? '✅' : '⬜' }</td>
								<td>${ this.getUserName(todo.assignedToUserId) }</td>
								<td>${ new Date(todo.createdAt).toLocaleDateString() }</td>
							</tr>
							`) }
						</tbody>
					</table>
					`) }
				`) }
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
		}
		.todos-page {
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
		input, select {
			padding: 0.4rem 0.75rem;
			border: 1px solid var(--border, #45475a);
			border-radius: 6px;
			background: var(--input-bg, #313244);
			color: var(--input-fg, #cdd6f4);
			font: inherit;
		}
		input {
			flex: 1;
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
		.completed td {
			opacity: 0.5;
		}
		.empty {
			color: var(--placeholder, #6c7086);
			font-style: italic;
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
