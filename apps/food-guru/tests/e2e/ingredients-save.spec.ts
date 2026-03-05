import { expect, test } from '@playwright/test';

interface IngredientPayload {
	name?:       string;
	quantity?:   string;
	categoryId?: string;
	notes?:      string;
	tags?:       string[];
	imageUrl?:   string;
	nutrients?: {
		key?:    string;
		value?:  string;
		unit?:   string;
		pinned?: boolean;
	}[];
}

async function setupIngredientMocks(page: import('@playwright/test').Page, updatePayloads: IngredientPayload[]): Promise<void> {
	const categoryID = 'cat-protein';
	const unassignedCategoryID = 'cat-unassigned';
	const ingredientID = 'i-greek-yogurt';

	const ingredient = {
		id:         ingredientID,
		name:       'Greek Yogurt',
		quantity:   'normal',
		inStock:    true,
		categoryId: categoryID,
		notes:      'Old note',
		tags:       [ 'dairy' ],
		imageUrl:   '',
		nutrients:  [] as {
			key:    string;
			value:  string;
			unit:   string;
			pinned: boolean;
		}[],
		ingredientOrder: 0,
	};

	await page.route('**/api/state', async (route) => {
		await route.fulfill({
			status:  200,
			headers: { 'content-type': 'application/json' },
			body:    JSON.stringify({
				mealPlans:            [],
				ingredients:          [ ingredient ],
				ingredientCategories: [
					{
						id:            categoryID,
						name:          'Protein',
						categoryOrder: 0,
						isSystem:      false,
					},
					{
						id:            unassignedCategoryID,
						name:          'Unassigned',
						categoryOrder: 1,
						isSystem:      true,
					},
				],
				unassignedCategoryId: unassignedCategoryID,
				settings:             {
					dailyCalorieGoal:   2000,
					showCompletedMeals: true,
				},
			}),
		});
	});

	await page.route('**/api/ingredients/*/usage', async (route) => {
		await route.fulfill({
			status:  200,
			headers: { 'content-type': 'application/json' },
			body:    JSON.stringify({
				mealPlans: [],
				dishes:    [],
			}),
		});
	});

	await page.route('**/api/ingredients/*', async (route) => {
		if (route.request().method() !== 'PUT') {
			await route.fallback();

			return;
		}

		const payload = route.request().postDataJSON() as IngredientPayload;
		updatePayloads.push(payload);

		if (typeof payload.name === 'string' && payload.name.trim().length > 0)
			ingredient.name = payload.name.trim();
		if (typeof payload.quantity === 'string' && payload.quantity.trim().length > 0)
			ingredient.quantity = payload.quantity.trim();
		if (typeof payload.categoryId === 'string' && payload.categoryId.trim().length > 0)
			ingredient.categoryId = payload.categoryId.trim();
		if (typeof payload.notes === 'string')
			ingredient.notes = payload.notes.trim();
		if (Array.isArray(payload.tags)) {
			ingredient.tags = payload.tags
				.map((tag) => String(tag).trim())
				.filter((tag) => tag.length > 0);
		}
		if (typeof payload.imageUrl === 'string')
			ingredient.imageUrl = payload.imageUrl.trim();
		if (Array.isArray(payload.nutrients)) {
			ingredient.nutrients = payload.nutrients.map((entry) => ({
				key:    String(entry.key ?? '').trim(),
				value:  String(entry.value ?? '').trim(),
				unit:   String(entry.unit ?? '').trim(),
				pinned: Boolean(entry.pinned),
			}));
		}

		await route.fulfill({
			status:  200,
			headers: { 'content-type': 'application/json' },
			body:    JSON.stringify(ingredient),
		});
	});
}

test('updates ingredient fields and sends saved values to update endpoint', async ({ page }) => {
	const updatePayloads = [] as IngredientPayload[];

	await setupIngredientMocks(page, updatePayloads);

	await page.goto('/ingredients');

	const tile = page.locator('.ingredient-tile').first();
	await expect(tile).toBeVisible();
	await tile.click();

	const nameInput = page.locator('input[data-field="name"]');
	const notesTextArea = page.locator('textarea');
	await expect(nameInput).toHaveValue('Greek Yogurt');

	await nameInput.fill('Skyr Yogurt');
	await notesTextArea.fill('Thicker texture and high protein.');

	const saveButton = page.getByRole('button', { name: 'Save Changes' });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();

	await expect.poll(() => updatePayloads.length).toBe(1);

	const sentPayload = updatePayloads[0] as IngredientPayload;
	expect(sentPayload.name).toBe('Skyr Yogurt');
	expect(sentPayload.notes).toBe('Thicker texture and high protein.');

	await expect(nameInput).toHaveValue('Skyr Yogurt');
	await expect(notesTextArea).toHaveValue('Thicker texture and high protein.');
	await expect(page.locator('.ingredient-tile .tile-label').first()).toHaveText('Skyr Yogurt');
});

test('captures latest typed value when saving directly from focused field', async ({ page }) => {
	const updatePayloads = [] as IngredientPayload[];

	await setupIngredientMocks(page, updatePayloads);
	await page.goto('/ingredients');

	const tile = page.locator('.ingredient-tile').first();
	await expect(tile).toBeVisible();
	await tile.click();

	const nameInput = page.locator('input[data-field="name"]');
	await nameInput.click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('Protein Yogurt');

	const saveButton = page.getByRole('button', { name: 'Save Changes' });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();

	await expect.poll(() => updatePayloads.length).toBe(1);
	const sentPayload = updatePayloads[0] as IngredientPayload;
	expect(sentPayload.name).toBe('Protein Yogurt');

	await expect(nameInput).toHaveValue('Protein Yogurt');
	await expect(page.locator('.ingredient-tile .tile-label').first()).toHaveText('Protein Yogurt');
});
