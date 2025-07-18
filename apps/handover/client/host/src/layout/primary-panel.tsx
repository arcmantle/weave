import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent, toTag } from '@arcmantle/lit-jsx';


export class PrimaryPanelCmp extends AdapterElement {

	static override tagName: string = 'ho-primary-panel';

	@property(String) accessor activeTemplateId: string = '';

	protected override render(): unknown {
		const ActionButton = toTag('div');
		const TableRow = toTag('div');
		const TableCell = toTag('div');
		const users = [
			{ id: '1', name: 'Alice', age: 30 },
			{ id: '2', name: 'Bob', age: 25 },
			{ id: '3', name: 'Charlie', age: 35 },
		];
		const template = (
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Age</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map(user => (
							<TableRow data-key={user.id}>
								<TableCell>{user.name}</TableCell>
								<TableCell>{user.age}</TableCell>
								<TableCell>
									<ActionButton />
									<ActionButton />
								</TableCell>
							</TableRow>
						))}
					</tbody>
				</table>
			</div>
		);

		return template;

		return <div>
			Primary content goes here.
		</div>;
	}

}


export const PrimaryPanel: ToComponent<PrimaryPanelCmp> =
	toComponent(PrimaryPanelCmp);
