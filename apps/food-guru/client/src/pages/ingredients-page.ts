import { chronicle } from '@arcmantle/chronicle/chronicle';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';

import { applyChronicleDraftHistoryMutation, rebindChronicleDraftRenderTracking } from '../state/chronicle-draft.ts';
import { foodGuruStore } from '../state/food-guru-store.ts';
import type { IngredientCategory, IngredientItem, IngredientUsage, NutrientEntry } from '../types.ts';


interface IngredientDraft {
	name:       string;
	categoryId: string;
	notes:      string;
	tags:       string;
	imageUrl:   string;
	nutrients:  NutrientEntry[];
}

type EditorTabId = 'overview' | 'image' | 'nutrients' | 'usage' | 'more';

const EDITOR_TAB_STORAGE_KEY = 'food-guru-ingredient-editor-tab';

const MACRO_KEYS = [
	{ key: 'calories',      label: 'Calories',      defaultUnit: 'kcal' },
	{ key: 'protein',       label: 'Protein',       defaultUnit: 'g' },
	{ key: 'carbohydrates', label: 'Carbohydrates', defaultUnit: 'g' },
	{ key: 'fat',           label: 'Fat',           defaultUnit: 'g' },
	{ key: 'fiber',         label: 'Fiber',         defaultUnit: 'g' },
	{ key: 'sugar',         label: 'Sugar',         defaultUnit: 'g' },
] as { key: string; label: string; defaultUnit: string; }[];

const MACRO_KEY_SET = new Set(MACRO_KEYS.map((m) => m.key));

@customElement('ingredients-page')
export class IngredientsPage extends LitElement {

	@state() protected ingredients = [] as IngredientItem[];
	@state() protected categories = [] as IngredientCategory[];
	@state() protected unassignedCategoryId = '';
	@state() protected isSeeding = false;
	@state() protected selectedIngredientId = '';
	@state() protected draft:           IngredientDraft | null = null;
	@state() protected draftRenderTick = 0;
	@state() protected isSaving = false;
	@state() protected saveError = '';
	@state() protected usage = null as IngredientUsage | null;
	@state() protected usageLoading = false;
	@state() protected activeEditorTab: EditorTabId = 'overview';

	protected tooltipOpenTimeout = null as number | null;
	protected tooltipCloseTimeout = null as number | null;
	protected activeTooltipId = '';
	protected initialSelectionApplied = false;
	protected draftUnsub: (() => void) | null = null;
	protected readonly bumpDraftRenderTick = (): void => {
		this.draftRenderTick++;
	};

	protected onStoreChanged = (): void => {
		const snapshot = foodGuruStore.getSnapshot();
		this.ingredients = snapshot.ingredients;
		this.categories = snapshot.ingredientCategories;
		this.unassignedCategoryId = snapshot.unassignedCategoryId;

		if (!this.initialSelectionApplied) {
			this.initialSelectionApplied = true;
			const urlId = this.readIngredientFromURL();
			if (urlId) {
				const ingredient = this.ingredients.find((item) => item.id === urlId) ?? null;
				if (ingredient) {
					this.selectedIngredientId = urlId;
					this.applyDraftFromIngredient(ingredient);
					void this.loadIngredientUsage(urlId);
				}
			}
		}
		else if (this.selectedIngredientId) {
			// If the selected ingredient no longer exists (e.g. deleted), clear the editor.
			// Do NOT re-apply the draft — the user may be mid-edit.
			const stillExists = this.ingredients.some((i) => i.id === this.selectedIngredientId);
			if (!stillExists)
				this.clearEditor();
		}

		this.ensurePlaceholderData();
	};

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadActiveEditorTab();
		foodGuruStore.addEventListener('change', this.onStoreChanged);
		this.onStoreChanged();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		foodGuruStore.removeEventListener('change', this.onStoreChanged);
		this.draftUnsub?.();
		this.draftUnsub = null;
		this.clearTooltipTimeouts();
	}

	protected clearTooltipTimeouts(): void {
		if (this.tooltipOpenTimeout !== null) {
			window.clearTimeout(this.tooltipOpenTimeout);
			this.tooltipOpenTimeout = null;
		}

		if (this.tooltipCloseTimeout !== null) {
			window.clearTimeout(this.tooltipCloseTimeout);
			this.tooltipCloseTimeout = null;
		}
	}

	protected ensurePlaceholderData(): void {
		if (this.isSeeding)
			return;

		const hasIngredients = this.ingredients.length > 0;
		const hasUserCategories = this.categories.some((category) => !category.isSystem);
		if (hasIngredients && hasUserCategories)
			return;

		void this.seedPlaceholderData();
	}

	protected async seedPlaceholderData(): Promise<void> {
		this.isSeeding = true;
		try {
			const categoryNames = [ 'Produce', 'Protein', 'Dairy', 'Dry Goods', 'Frozen' ];
			const placeholderItems = [
				{
					name:     'Chicken Breast',
					category: 'Protein',
					notes:    'Good for stir-fry and wraps.',
					tags:     [ 'protein', 'dinner' ],
				},
				{
					name:     'Greek Yogurt',
					category: 'Dairy',
					notes:    'Breakfast and sauce base.',
					tags:     [ 'dairy', 'breakfast' ],
				},
				{
					name:     'Brown Rice',
					category: 'Dry Goods',
					notes:    'Batch cook on Sunday.',
					tags:     [ 'grain', 'meal-prep' ],
				},
				{
					name:     'Spinach',
					category: 'Produce',
					notes:    'Use first in quick lunches.',
					tags:     [ 'greens', 'quick' ],
				},
				{
					name:     'Broccoli',
					category: 'Produce',
					notes:    'Roast with olive oil.',
					tags:     [ 'vegetable', 'side' ],
				},
				{
					name:     'Eggs',
					category: 'Protein',
					notes:    'Core breakfast ingredient.',
					tags:     [ 'protein', 'breakfast' ],
				},
				{
					name:     'Parmesan',
					category: 'Dairy',
					notes:    'Top pasta and salads.',
					tags:     [ 'dairy', 'flavor' ],
				},
				{
					name:     'Mixed Berries',
					category: 'Frozen',
					notes:    'Smoothies and oats.',
					tags:     [ 'fruit', 'smoothie' ],
				},
				{
					name:     'Peas',
					category: 'Frozen',
					notes:    'Easy veg add-on.',
					tags:     [ 'vegetable', 'quick' ],
				},
				{
					name:     'Oats',
					category: 'Dry Goods',
					notes:    'Daily breakfast staple.',
					tags:     [ 'grain', 'breakfast' ],
				},
			];

			const existingCategoryNames = new Set(
				this.categories
					.filter((category) => !category.isSystem)
					.map((category) => category.name.toLowerCase()),
			);

			for (const categoryName of categoryNames) {
				if (existingCategoryNames.has(categoryName.toLowerCase()))
					continue;

				await foodGuruStore.addIngredientCategory(categoryName);
			}

			const latest = foodGuruStore.getSnapshot();
			if (latest.ingredients.length > 0)
				return;

			const categoryByName = new Map(
				latest.ingredientCategories.map((category) => [ category.name.toLowerCase(), category.id ]),
			);

			for (const ingredient of placeholderItems) {
				const categoryId = categoryByName.get(ingredient.category.toLowerCase()) ?? latest.unassignedCategoryId;
				await foodGuruStore.addIngredient({
					name:  ingredient.name,
					categoryId,
					notes: ingredient.notes,
					tags:  ingredient.tags,
				});
			}
		}
		finally {
			this.isSeeding = false;
		}
	}

	protected handleMoveMenuClick(event: Event): void {
		event.stopPropagation();
	}

	protected handleMoveHandlePointerDown(event: Event): void {
		event.stopPropagation();
		this.hideActiveTooltip();
	}

	protected handleMoveIngredientClick(event: Event): void {
		event.stopPropagation();
		const button = event.currentTarget as HTMLButtonElement;
		const ingredientId = button.dataset['ingredientId'] ?? '';
		const categoryId = button.dataset['targetCategoryId'] ?? '';
		if (!ingredientId || !categoryId)
			return;

		this.moveIngredientToCategory(ingredientId, categoryId);

		const menuId = button.dataset['menuId'] ?? '';
		if (!menuId)
			return;

		const menu = this.getPopoverElement(menuId);
		menu?.hidePopover();
	}

	protected handleTooltipOpen(event: Event): void {
		if (this.isMoveMenuOpen())
			return;

		const target = event.target as HTMLElement | null;
		if (target?.closest('.tile-handle, .move-menu'))
			return;

		const tile = event.currentTarget as HTMLElement;
		const tooltipId = tile.dataset['tooltipId'] ?? '';
		if (!tooltipId)
			return;

		this.clearTooltipTimeouts();
		this.tooltipOpenTimeout = window.setTimeout(() => {
			const tooltip = this.getTooltipElement(tooltipId);
			if (!tooltip)
				return;

			if (this.activeTooltipId && this.activeTooltipId !== tooltipId) {
				const activeTooltip = this.getTooltipElement(this.activeTooltipId);
				if (activeTooltip)
					activeTooltip.hidePopover();
			}

			tooltip.showPopover();
			this.activeTooltipId = tooltipId;
			this.tooltipOpenTimeout = null;
		}, 120);
	}

	protected handleTooltipClose(event: Event): void {
		const tile = event.currentTarget as HTMLElement;
		const tooltipId = tile.dataset['tooltipId'] ?? '';
		if (!tooltipId)
			return;

		if (this.tooltipOpenTimeout !== null) {
			window.clearTimeout(this.tooltipOpenTimeout);
			this.tooltipOpenTimeout = null;
		}

		if (this.tooltipCloseTimeout !== null)
			window.clearTimeout(this.tooltipCloseTimeout);

		this.tooltipCloseTimeout = window.setTimeout(() => {
			const tooltip = this.getTooltipElement(tooltipId);
			if (!tooltip)
				return;

			tooltip.hidePopover();
			if (this.activeTooltipId === tooltipId)
				this.activeTooltipId = '';

			this.tooltipCloseTimeout = null;
		}, 90);
	}

	protected isMoveMenuOpen(): boolean {
		return this.renderRoot.querySelector('.move-menu:popover-open') !== null;
	}

	protected hideActiveTooltip(): void {
		this.clearTooltipTimeouts();
		if (!this.activeTooltipId)
			return;

		const tooltip = this.getTooltipElement(this.activeTooltipId);
		tooltip?.hidePopover();
		this.activeTooltipId = '';
	}

	protected getPopoverElement(popoverId: string): HTMLElement | null {
		const popover = this.renderRoot.querySelector(`#${ popoverId }`) as HTMLElement | null;
		if (!popover || typeof popover.showPopover !== 'function' || typeof popover.hidePopover !== 'function')
			return null;

		return popover;
	}

	protected getTooltipElement(tooltipId: string): HTMLElement | null {
		return this.getPopoverElement(tooltipId);
	}

	protected getCategoryIngredientIds(categoryId: string): string[] {
		return this.ingredients
			.filter((ingredient) => ingredient.categoryId === categoryId)
			.sort((left, right) => left.ingredientOrder - right.ingredientOrder)
			.map((ingredient) => ingredient.id);
	}

	protected moveIngredientToCategory(ingredientId: string, categoryId: string): void {
		const nextIds = this.getCategoryIngredientIds(categoryId).filter((id) => id !== ingredientId);
		nextIds.push(ingredientId);
		void foodGuruStore.reorderIngredients(categoryId, nextIds);
	}

	protected getCategoryIngredients(categoryID: string): IngredientItem[] {
		return this.ingredients
			.filter((ingredient) => ingredient.categoryId === categoryID)
			.sort((left, right) => left.ingredientOrder - right.ingredientOrder);
	}

	protected getMoveTargetCategories(ingredient: IngredientItem): IngredientCategory[] {
		return this.categories.filter((category) => category.id !== ingredient.categoryId);
	}

	protected getCategoryCount(categoryID: string): number {
		return this.ingredients.filter((ingredient) => ingredient.categoryId === categoryID).length;
	}

	protected getIngredientIcon(ingredient: IngredientItem): string {
		const value = `${ ingredient.name } ${ ingredient.tags.join(' ') }`.toLowerCase();
		if (value.includes('milk') || value.includes('cheese') || value.includes('yogurt'))
			return '🥛';
		if (value.includes('beef') || value.includes('chicken') || value.includes('fish') || value.includes('meat'))
			return '🥩';
		if (value.includes('rice') || value.includes('grain') || value.includes('pasta') || value.includes('bread'))
			return '🌾';
		if (value.includes('apple') || value.includes('fruit') || value.includes('berry') || value.includes('banana'))
			return '🍎';
		if (value.includes('carrot') || value.includes('vegetable') || value.includes('pepper') || value.includes('broccoli'))
			return '🥕';

		return '🥣';
	}

	protected get selectedIngredient(): IngredientItem | null {
		return this.ingredients.find((ingredient) => ingredient.id === this.selectedIngredientId) ?? null;
	}

	protected applyDraftFromIngredient(ingredient: IngredientItem): void {
		const existingByKey = new Map(ingredient.nutrients.map((n) => [ n.key, n ]));
		const macroEntries = MACRO_KEYS.map((macro) => existingByKey.get(macro.key) ?? {
			key:    macro.key,
			value:  '',
			unit:   macro.defaultUnit,
			pinned: false,
		});
		const customEntries = ingredient.nutrients
			.filter((n) => !MACRO_KEY_SET.has(n.key))
			.map((n) => ({ ...n }));

		this.draft = chronicle<IngredientDraft>({
			name:       ingredient.name,
			categoryId: ingredient.categoryId,
			notes:      ingredient.notes,
			tags:       ingredient.tags.join(', '),
			imageUrl:   ingredient.imageUrl ?? '',
			nutrients:  [ ...macroEntries, ...customEntries ],
		});
		this.draftUnsub = rebindChronicleDraftRenderTracking(
			this.draft,
			this.bumpDraftRenderTick,
			this.draftUnsub,
		);
	}

	protected clearEditor(): void {
		this.draftUnsub?.();
		this.draftUnsub = null;
		this.selectedIngredientId = '';
		this.draft = null;
		this.draftRenderTick = 0;
		this.usage = null;
		this.usageLoading = false;
		this.saveError = '';
	}

	protected handleTileClick(event: Event): void {
		const target = event.target as HTMLElement | null;
		if (target?.closest('.tile-handle, .move-menu'))
			return;

		const tile = event.currentTarget as HTMLElement;
		const ingredientID = tile.dataset['ingredientId'] ?? '';
		if (!ingredientID)
			return;

		const ingredient = this.ingredients.find((item) => item.id === ingredientID) ?? null;
		if (!ingredient)
			return;

		this.selectedIngredientId = ingredientID;
		this.applyDraftFromIngredient(ingredient);
		this.saveError = '';
		this.writeIngredientToURL(ingredientID);
		void this.loadIngredientUsage(ingredientID);
	}

	protected get editorTabs(): { id: EditorTabId; label: string; }[] {
		return [
			{ id: 'overview',  label: 'Overview' },
			{ id: 'image',     label: 'Image' },
			{ id: 'nutrients', label: 'Nutrients' },
			{ id: 'usage',     label: 'Used In' },
			{ id: 'more',      label: 'More' },
		];
	}

	protected handleEditorTabClick(event: Event): void {
		const button = event.currentTarget as HTMLButtonElement;
		const tabID = button.dataset['tab'] as EditorTabId | undefined;
		if (!tabID)
			return;

		this.activeEditorTab = tabID;
		this.persistActiveEditorTab(tabID);
	}

	protected isEditorTab(tabID: string): tabID is EditorTabId {
		return tabID === 'overview'
			|| tabID === 'image'
			|| tabID === 'nutrients'
			|| tabID === 'usage'
			|| tabID === 'more';
	}

	protected loadActiveEditorTab(): void {
		try {
			const stored = window.localStorage.getItem(EDITOR_TAB_STORAGE_KEY);
			if (!stored)
				return;

			const normalized = stored.trim();
			if (!this.isEditorTab(normalized))
				return;

			this.activeEditorTab = normalized;
		}
		catch {
			return;
		}
	}

	protected persistActiveEditorTab(tabID: EditorTabId): void {
		try {
			window.localStorage.setItem(EDITOR_TAB_STORAGE_KEY, tabID);
		}
		catch {
			return;
		}
	}

	protected async loadIngredientUsage(ingredientID: string): Promise<void> {
		this.usageLoading = true;
		try {
			this.usage = await foodGuruStore.getIngredientUsage(ingredientID);
		}
		catch {
			this.usage = {
				mealPlans: [],
				dishes:    [],
			};
		}
		finally {
			this.usageLoading = false;
		}
	}

	protected readIngredientFromURL(): string {
		try {
			return new URLSearchParams(window.location.search).get('ingredient') ?? '';
		}
		catch {
			return '';
		}
	}

	protected writeIngredientToURL(id: string): void {
		try {
			const params = new URLSearchParams(window.location.search);
			params.set('ingredient', id);
			window.history.replaceState(null, '', `${ window.location.pathname }?${ params.toString() }`);
		}
		catch {
			return;
		}
	}

	protected clearIngredientFromURL(): void {
		try {
			const params = new URLSearchParams(window.location.search);
			params.delete('ingredient');
			const search = params.toString();
			window.history.replaceState(null, '', window.location.pathname + (search ? `?${ search }` : ''));
		}
		catch {
			return;
		}
	}

	protected handleCloseEditor(): void {
		this.clearIngredientFromURL();
		this.clearEditor();
	}

	protected handleDraftInput(event: Event): void {
		if (!this.draft)
			return;

		const input = event.currentTarget as HTMLInputElement;
		const field = input.dataset['field'] ?? '';
		if (field === 'name')
			this.draft.name = input.value;
		if (field === 'imageUrl')
			this.draft.imageUrl = input.value;
		if (field === 'tags')
			this.draft.tags = input.value;
	}

	protected handleDraftTextArea(event: Event): void {
		if (!this.draft)
			return;

		const input = event.currentTarget as HTMLTextAreaElement;
		this.draft.notes = input.value;
	}

	protected handleDraftCategory(event: Event): void {
		if (!this.draft)
			return;

		const select = event.currentTarget as HTMLSelectElement;
		this.draft.categoryId = select.value;
	}

	protected get customNutrientEntries(): { nutrient: NutrientEntry; index: number; }[] {
		if (!this.draft)
			return [];

		return this.draft.nutrients
			.map((nutrient, index) => ({ nutrient, index }))
			.filter(({ nutrient }) => !MACRO_KEY_SET.has(nutrient.key));
	}

	protected handleMacroInput(event: Event): void {
		if (!this.draft)
			return;

		const input = event.currentTarget as HTMLInputElement;
		const key = input.dataset['key'] ?? '';
		const field = input.dataset['field'] ?? '';
		if (!key)
			return;

		const entry = this.draft.nutrients.find((n) => n.key === key);
		if (!entry)
			return;

		if (field === 'value')
			entry.value = input.value;
		if (field === 'unit')
			entry.unit = input.value;
	}

	protected handleToggleNutrientPin(event: Event): void {
		if (!this.draft)
			return;

		const button = event.currentTarget as HTMLButtonElement;
		const index = Number(button.dataset['index'] ?? '-1');
		if (index < 0 || index >= this.draft.nutrients.length)
			return;

		const nutrient = this.draft.nutrients[index];
		if (!nutrient)
			return;

		nutrient.pinned = !nutrient.pinned;
	}

	protected handleAddNutrientRow(): void {
		if (!this.draft)
			return;

		this.draft.nutrients.push({ key: '', value: '', unit: '', pinned: false });
	}

	protected handleNutrientInput(event: Event): void {
		if (!this.draft)
			return;

		const input = event.currentTarget as HTMLInputElement;
		const index = Number(input.dataset['index'] ?? '-1');
		const field = input.dataset['field'] ?? '';
		if (index < 0 || index >= this.draft.nutrients.length)
			return;

		const nutrient = this.draft.nutrients[index];
		if (!nutrient)
			return;

		if (field === 'key')
			nutrient.key = input.value;
		if (field === 'value')
			nutrient.value = input.value;
		if (field === 'unit')
			nutrient.unit = input.value;
	}

	protected handleRemoveNutrient(event: Event): void {
		if (!this.draft)
			return;

		const button = event.currentTarget as HTMLButtonElement;
		const index = Number(button.dataset['index'] ?? '-1');
		if (index < 0 || index >= this.draft.nutrients.length)
			return;

		this.draft.nutrients.splice(index, 1);
	}

	protected async handleImageUpload(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0)
			return;

		const file = files.item(0);
		if (!file)
			return;

		const dataURL = await this.toDataURL(file);
		if (!dataURL)
			return;

		this.draft!.imageUrl = dataURL;
	}

	protected async toDataURL(file: File): Promise<string> {
		return await new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : ''));
			reader.addEventListener('error', () => resolve(''));
			reader.readAsDataURL(file);
		});
	}

	protected handleUndo(): void {
		applyChronicleDraftHistoryMutation(
			this.draft,
			(draft) => chronicle.canUndo(draft),
			(draft) => chronicle.undo(draft, 1),
			this.bumpDraftRenderTick,
		);
	}

	protected handleRedo(): void {
		applyChronicleDraftHistoryMutation(
			this.draft,
			(draft) => chronicle.canRedo(draft),
			(draft) => chronicle.redo(draft, 1),
			this.bumpDraftRenderTick,
		);
	}

	protected async handleSaveIngredient(): Promise<void> {
		const selected = this.selectedIngredient;
		if (!selected || !this.draft)
			return;

		this.commitVisibleEditorControlValues();
		if (chronicle.isPristine(this.draft))
			return;

		this.isSaving = true;
		this.saveError = '';
		try {
			await foodGuruStore.updateIngredient(selected.id, {
				name:       this.draft.name,
				categoryId: this.draft.categoryId,
				notes:      this.draft.notes,
				tags:       this.draft.tags.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0),
				imageUrl:   this.draft.imageUrl,
				nutrients:  [ ...this.draft.nutrients.map((n) => ({ ...n })) ],
			});

			// Re-apply draft from the confirmed persisted state so the form
			// reflects exactly what the server stored (e.g. sanitized nutrients).
			const saved = this.ingredients.find((i) => i.id === selected.id);
			if (saved)
				this.applyDraftFromIngredient(saved);

			if (this.selectedIngredientId)
				void this.loadIngredientUsage(this.selectedIngredientId);
		}
		catch (err) {
			this.saveError = err instanceof Error ? err.message : 'Save failed';
		}
		finally {
			this.isSaving = false;
		}
	}

	protected commitVisibleEditorControlValues(): void {
		if (!this.draft)
			return;

		const nameInput = this.renderRoot.querySelector('input[data-field="name"]') as HTMLInputElement | null;
		if (nameInput && this.draft.name !== nameInput.value)
			this.draft.name = nameInput.value;

		const tagsInput = this.renderRoot.querySelector('input[data-field="tags"]') as HTMLInputElement | null;
		if (tagsInput && this.draft.tags !== tagsInput.value)
			this.draft.tags = tagsInput.value;

		const imageUrlInput = this.renderRoot.querySelector('input[data-field="imageUrl"]') as HTMLInputElement | null;
		if (imageUrlInput && this.draft.imageUrl !== imageUrlInput.value)
			this.draft.imageUrl = imageUrlInput.value;

		const notesTextArea = this.renderRoot.querySelector('.editor-section textarea') as HTMLTextAreaElement | null;
		if (notesTextArea && this.draft.notes !== notesTextArea.value)
			this.draft.notes = notesTextArea.value;

		const categorySelect = this.renderRoot.querySelector('.editor-section select') as HTMLSelectElement | null;
		if (categorySelect && this.draft.categoryId !== categorySelect.value)
			this.draft.categoryId = categorySelect.value;

		const macroInputs = this.renderRoot.querySelectorAll(
			'.macro-grid input[data-key][data-field]',
		) as NodeListOf<HTMLInputElement>;
		for (const input of macroInputs) {
			const key = input.dataset['key'] ?? '';
			const field = input.dataset['field'] ?? '';
			if (!key)
				continue;

			const nutrient = this.draft.nutrients.find((n) => n.key === key);
			if (!nutrient)
				continue;

			if (field === 'value' && nutrient.value !== input.value)
				nutrient.value = input.value;
			if (field === 'unit' && nutrient.unit !== input.value)
				nutrient.unit = input.value;
		}

		const nutrientInputs = this.renderRoot.querySelectorAll(
			'.nutrient-row input[data-index][data-field]',
		) as NodeListOf<HTMLInputElement>;
		for (const input of nutrientInputs) {
			const index = Number(input.dataset['index'] ?? '-1');
			const field = input.dataset['field'] ?? '';
			if (index < 0 || index >= this.draft.nutrients.length)
				continue;

			const nutrient = this.draft.nutrients[index];
			if (!nutrient)
				continue;

			if (field === 'key' && nutrient.key !== input.value)
				nutrient.key = input.value;
			if (field === 'value' && nutrient.value !== input.value)
				nutrient.value = input.value;
			if (field === 'unit' && nutrient.unit !== input.value)
				nutrient.unit = input.value;
		}
	}

	override render(): unknown {
		const selected = this.selectedIngredient;
		const draft = this.draft;
		const hasImage = (draft?.imageUrl ?? '').trim().length > 0;
		const usage = this.usage;
		const isDirty = draft !== null && !chronicle.isPristine(draft);
		const canUndo = draft !== null && chronicle.canUndo(draft);
		const canRedo = draft !== null && chronicle.canRedo(draft);
		void this.draftRenderTick;

		return html`
		<section class="workspace">
			<aside class="bucket-strip">
				<div class="bucket-strip-header">
					<h3>Ingredient Groups</h3>
					<span>Use tile handles to move ingredients between groups</span>
				</div>
				<ul>
					${ repeat(this.categories, (category) => category.id, (category) => html`
					<li class="bucket" data-category-id=${ category.id }>
						<div>
							<strong>${ category.name }</strong>
							<span>${ this.getCategoryCount(category.id) } items</span>
						</div>
					</li>
					`) }
				</ul>
			</aside>

			<div class="sections">
				${ repeat(this.categories, (category) => category.id, (category) => html`
				<section class="category-section" data-category-id=${ category.id }>
					<div class="category-title">
						<h3>${ category.name }</h3>
						<span>${ this.getCategoryCount(category.id) } ingredients</span>
					</div>
					<div class="tile-grid">
						${ repeat(
							this.getCategoryIngredients(category.id),
							ingredient => ingredient.id,
							ingredient => html`
							<article
								class="ingredient-tile"
								data-ingredient-id=${ ingredient.id }
								data-tooltip-id=${ `ingredient-tooltip-${ ingredient.id }` }
								@click=${ this.handleTileClick }
								@mouseenter=${ this.handleTooltipOpen }
								@mouseleave=${ this.handleTooltipClose }
								@focusin=${ this.handleTooltipOpen }
								@focusout=${ this.handleTooltipClose }
								style=${ `anchor-name: --ingredient-anchor-${ ingredient.id };` }
							>
								<button
									class="tile-handle"
									type="button"
									aria-label=${ `Move ${ ingredient.name } to another group` }
									popovertarget=${ `ingredient-move-menu-${ ingredient.id }` }
									popovertargetaction="toggle"
									@pointerdown=${ this.handleMoveHandlePointerDown }
									style=${ `anchor-name: --ingredient-menu-anchor-${ ingredient.id };` }
								>
									⋮
								</button>
								<div class="tile-image">
									<div class="icon">${ this.getIngredientIcon(ingredient) }</div>
								</div>
								<span class="tile-label">${ ingredient.name }</span>
								<div
									id=${ `ingredient-move-menu-${ ingredient.id }` }
									class="move-menu"
									popover="auto"
									style=${ `position-anchor: --ingredient-menu-anchor-${ ingredient.id };` }
									@click=${ this.handleMoveMenuClick }
								>
									${ repeat(
										this.getMoveTargetCategories(ingredient),
										targetCategory => targetCategory.id,
										targetCategory => html`
										<button
											type="button"
											class="move-option"
											data-ingredient-id=${ ingredient.id }
											data-target-category-id=${ targetCategory.id }
											data-menu-id=${ `ingredient-move-menu-${ ingredient.id }` }
											@click=${ this.handleMoveIngredientClick }
										>
											Move to ${ targetCategory.name }
										</button>
										`,
									) }
								</div>
								<div
									id=${ `ingredient-tooltip-${ ingredient.id }` }
									class="hover-card"
									popover="manual"
									style=${ `position-anchor: --ingredient-anchor-${ ingredient.id };` }
								>
									<strong>${ ingredient.name }</strong>
									<p>${ ingredient.quantity }</p>
									${ when(ingredient.notes.trim().length > 0, () => html`
									<p>${ ingredient.notes }</p>
									`, () => html`
									<p>No notes yet.</p>
									`) }
									${ when(ingredient.tags.length > 0, () => html`
									<div class="tag-list">
										${ repeat(ingredient.tags, (tag) => tag, (tag) => html`
										<span>${ tag }</span>
										`) }
									</div>
									`) }
								</div>
							</article>
							`,
						) }
					</div>
				</section>
				`) }
			</div>

			<aside class="editor-panel">
				${ when(selected !== null && draft !== null, () => html`
				<div class="editor-header">
					<h3>Edit Ingredient</h3>
					<div class="editor-header-actions">
						${ when(isDirty, () => html`
						<span class="dirty-indicator">Unsaved changes</span>
						`) }
						<button
							type="button"
							class="undo-redo-button"
							?disabled=${ !canUndo }
							title="Undo"
							@click=${ this.handleUndo }
						>↩</button>
						<button
							type="button"
							class="undo-redo-button"
							?disabled=${ !canRedo }
							title="Redo"
							@click=${ this.handleRedo }
						>↪</button>
						<button type="button" @click=${ this.handleCloseEditor }>Close</button>
					</div>
				</div>
				<div class="editor-body">
					<div class="editor-tabs" role="tablist" aria-label="Ingredient details tabs">
						${ repeat(this.editorTabs, (tab) => tab.id, (tab) => html`
						<button
							type="button"
							class="editor-tab"
							data-tab=${ tab.id }
							?data-active=${ this.activeEditorTab === tab.id }
							@click=${ this.handleEditorTabClick }
						>
							${ tab.label }
						</button>
						`) }
					</div>

					${ when(this.activeEditorTab === 'overview', () => html`
					<section class="editor-section" role="tabpanel" aria-label="Overview">
						<h4>Overview</h4>
						<label>
							<span>Name</span>
							<input data-field="name" .value=${ draft!.name } @change=${ this.handleDraftInput }>
						</label>
						<label>
							<span>Category</span>
							<select .value=${ draft!.categoryId } @change=${ this.handleDraftCategory }>
								${ repeat(this.categories, (category) => category.id, (category) => html`
								<option value=${ category.id }>${ category.name }</option>
								`) }
							</select>
						</label>
						<label>
							<span>Tags (comma separated)</span>
							<input data-field="tags" .value=${ draft!.tags } @change=${ this.handleDraftInput }>
						</label>
						<label>
							<span>Notes</span>
							<textarea .value=${ draft!.notes } @change=${ this.handleDraftTextArea }></textarea>
						</label>
						<div class="nutrient-snapshot">
							<span class="nutrient-snapshot-title">Macros</span>
							<div class="nutrient-snapshot-grid">
								${ repeat(MACRO_KEYS, (macro) => macro.key, (macro) => {
									const entry = draft!.nutrients.find((n) => n.key === macro.key);
									const hasValue = (entry?.value ?? '').trim().length > 0;

									return html`
									<div class="nutrient-pill" ?data-empty=${ !hasValue }>
										<span class="nutrient-pill-label">${ macro.label }</span>
										<span class="nutrient-pill-value">${ hasValue ? `${ entry!.value } ${ entry!.unit }` : '—' }</span>
									</div>
									`;
								}) }
							</div>
							${ when(draft!.nutrients.some((n) => !MACRO_KEY_SET.has(n.key) && n.pinned), () => html`
							<span class="nutrient-snapshot-title">Pinned</span>
							<div class="nutrient-snapshot-grid">
								${ repeat(
									draft!.nutrients.filter((n) => !MACRO_KEY_SET.has(n.key) && n.pinned),
									(n) => n.key,
									(n) => html`
									<div class="nutrient-pill">
										<span class="nutrient-pill-label">${ n.key }</span>
										<span class="nutrient-pill-value">${ n.value } ${ n.unit }</span>
									</div>
									`,
								) }
							</div>
							`) }
						</div>
					</section>
					`) }

					${ when(this.activeEditorTab === 'image', () => html`
					<section class="editor-section" role="tabpanel" aria-label="Image">
						<h4>Image</h4>
						<label>
							<span>Image URL</span>
							<input data-field="imageUrl" .value=${ draft!.imageUrl } @change=${ this.handleDraftInput }>
						</label>
						<label>
							<span>Upload image file</span>
							<input type="file" accept="image/*" @change=${ this.handleImageUpload }>
						</label>
						${ when(hasImage, () => html`
						<div class="image-preview">
							<img src=${ draft!.imageUrl } alt=${ `${ draft!.name || selected?.name || 'Ingredient' } preview` }>
						</div>
						`) }
					</section>
					`) }

					${ when(this.activeEditorTab === 'nutrients', () => html`
					<section class="editor-section" role="tabpanel" aria-label="Nutrients">
						<h4>Macros</h4>
						<div class="nutrient-grid macro-grid">
							${ repeat(MACRO_KEYS, (macro) => macro.key, (macro) => {
								const entry = draft!.nutrients.find((n) => n.key === macro.key);

								return html`
								<div class="nutrient-macro-row">
									<span class="macro-label">${ macro.label }</span>
									<input
										placeholder="Value"
										data-key=${ macro.key }
										data-field="value"
										.value=${ entry?.value ?? '' }
										@change=${ this.handleMacroInput }
									>
									<input
										placeholder="Unit"
										data-key=${ macro.key }
										data-field="unit"
										.value=${ entry?.unit ?? macro.defaultUnit }
										@change=${ this.handleMacroInput }
									>
								</div>
								`;
							}) }
						</div>
						<div class="section-title-row">
							<h4>Custom</h4>
							<button type="button" @click=${ this.handleAddNutrientRow }>Add nutrient</button>
						</div>
						<div class="nutrient-grid">
							${ repeat(this.customNutrientEntries, ({ index }) => index, ({ nutrient, index }) => html`
							<div class="nutrient-row">
								<input
									placeholder="Nutrient"
									data-index=${ String(index) }
									data-field="key"
									.value=${ nutrient.key }
									@change=${ this.handleNutrientInput }
								>
								<input
									placeholder="Value"
									data-index=${ String(index) }
									data-field="value"
									.value=${ nutrient.value }
									@change=${ this.handleNutrientInput }
								>
								<input
									placeholder="Unit"
									data-index=${ String(index) }
									data-field="unit"
									.value=${ nutrient.unit }
									@change=${ this.handleNutrientInput }
								>
								<button
									type="button"
									class="pin-button"
									data-index=${ String(index) }
									?data-pinned=${ nutrient.pinned }
									title=${ nutrient.pinned ? 'Unpin from overview' : 'Pin to overview' }
									@click=${ this.handleToggleNutrientPin }
								>📌</button>
								<button
									type="button"
									data-index=${ String(index) }
									@click=${ this.handleRemoveNutrient }
								>✕</button>
							</div>
							`) }
						</div>
					</section>
					`) }

					${ when(this.activeEditorTab === 'usage', () => html`
					<section class="editor-section usage-section" role="tabpanel" aria-label="Used In">
						<h4>Used In</h4>
						${ when(this.usageLoading, () => html`
						<p>Loading usage…</p>
						`, () => html`
						<div class="usage-columns">
							<div>
								<strong>Meal Plans</strong>
								<ul>
									${ when((usage?.mealPlans.length ?? 0) > 0, () => html`
										${ repeat(
											usage?.mealPlans ?? [],
											meal => meal.id,
											meal => html`<li>${ meal.day } · ${ meal.name }</li>`,
										) }
									`, () => html`<li>None yet</li>`) }
								</ul>
							</div>
							<div>
								<strong>Dishes</strong>
								<ul>
									${ when((usage?.dishes.length ?? 0) > 0, () => html`
										${ repeat(
											usage?.dishes ?? [],
											dish => dish.id,
											dish => html`<li>${ dish.name }</li>`,
										) }
									`, () => html`<li>None yet</li>`) }
								</ul>
							</div>
						</div>
						`) }
					</section>
					`) }

					${ when(this.activeEditorTab === 'more', () => html`
					<section class="editor-section" role="tabpanel" aria-label="More">
						<h4>More</h4>
						<p>This tab is reserved for future ingredient functionality.</p>
					</section>
					`) }

					<div class="editor-actions">
						${ when(this.saveError.length > 0, () => html`
						<span class="save-error">${ this.saveError }</span>
						`) }
						<button
							type="button"
							?disabled=${ this.isSaving }
							@click=${ this.handleSaveIngredient }
						>${ this.isSaving ? 'Saving…' : 'Save Changes' }</button>
					</div>
				</div>
				`, () => html`
				<div class="editor-empty">
					<h3>Ingredient Details</h3>
					<p>Select an ingredient tile to edit image, nutrients, and usage details.</p>
				</div>
				`) }
			</aside>
		</section>
		`;
	}

	static override styles: ReturnType<typeof css> = css`
		:host {
			display: grid;
			height: 100%;
			min-height: 0;
			overflow: hidden;
		}
		:host * {
			box-sizing: border-box;
		}
		.workspace {
			display: grid;
			grid-template-columns: 260px minmax(0, 1fr) 440px;
			gap: 0;
			height: 100%;
			min-height: 0;
			overflow: hidden;
			padding: 0;
		}
		h3 {
			margin: 0;
		}
		.bucket-strip {
			position: sticky;
			top: 0;
			align-content: start;
			max-height: 100%;
			padding: 10px 12px;
			border-right: 1px solid var(--fg-border);
			overflow: auto;
			& ul {
				display: grid;
				gap: 8px;
				margin: 0;
				padding: 0;
				list-style: none;
			}
		}
		.bucket-strip-header {
			display: grid;
			gap: 4px;
			& span {
				font-size: 12px;
				color: var(--fg-text-muted);
			}
		}
		.bucket {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			padding: 8px 6px;
			border-bottom: 1px dashed var(--fg-border);
			background: transparent;
			& div {
				display: grid;
				gap: 2px;
				& span {
					font-size: 12px;
					color: var(--fg-text-muted);
				}
			}
		}
		.sections {
			display: grid;
			align-content: start;
			gap: 12px;
			overflow: auto;
			padding: 10px 12px;
		}
		.editor-panel {
			display: grid;
			grid-template-rows: auto 1fr;
			border-left: 1px solid var(--fg-border);
			background: var(--fg-surface);
			overflow: hidden;
			& .editor-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 10px 12px;
				border-bottom: 1px solid var(--fg-border);
				& button {
					padding: 5px 8px;
					border: 1px solid var(--fg-border);
					border-radius: 6px;
					background: transparent;
					color: var(--fg-text);
				}
				& .editor-header-actions {
					display: flex;
					align-items: center;
					gap: 6px;
				}
				& .dirty-indicator {
					font-size: 11px;
					color: var(--fg-warning, #e0a030);
					margin-right: 4px;
				}
				& .undo-redo-button {
					display: grid;
					place-items: center;
					width: 28px;
					height: 28px;
					padding: 0;
					font-size: 14px;
					&:disabled {
						opacity: 0.3;
						cursor: default;
					}
				}
			}
			& .editor-body {
				display: grid;
				align-content: start;
				gap: 12px;
				overflow: auto;
				padding: 12px;
			}
			& .editor-empty {
				display: grid;
				align-content: start;
				gap: 8px;
				padding: 12px;
				& p {
					margin: 0;
					color: var(--fg-text-muted);
					font-size: 13px;
				}
			}
		}
		.editor-section {
			display: grid;
			gap: 8px;
			padding: 10px;
			border: 1px solid var(--fg-border);
			border-radius: 8px;
			background: var(--fg-surface-soft);
			& h4 {
				margin: 0;
				font-size: 13px;
			}
			& label {
				display: grid;
				gap: 4px;
				& span {
					font-size: 11px;
					color: var(--fg-text-muted);
				}
			}
			& input,
			& select,
			& textarea,
			& button {
				padding: 6px 8px;
				border: 1px solid var(--fg-border);
				border-radius: 6px;
				background: var(--fg-bg);
				color: var(--fg-text);
			}
			& textarea {
				min-height: 74px;
				resize: vertical;
			}
			& .image-preview {
				display: grid;
				place-items: center;
				padding: 8px;
				border: 1px dashed var(--fg-border);
				border-radius: 6px;
				background: var(--fg-bg);
				& img {
					max-width: 100%;
					max-height: 140px;
					object-fit: cover;
					border-radius: 6px;
				}
			}
			& .section-title-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			& .nutrient-grid {
				display: grid;
				gap: 6px;
				&.macro-grid {
					gap: 4px;
					margin-bottom: 8px;
				}
			}
			& .nutrient-row {
				display: grid;
				grid-template-columns: 1fr 72px 58px 26px 26px;
				gap: 4px;
			}
			& .nutrient-macro-row {
				display: grid;
				grid-template-columns: 110px 1fr 64px;
				align-items: center;
				gap: 6px;
				& .macro-label {
					font-size: 12px;
					color: var(--fg-text-muted);
					font-weight: 500;
				}
			}
			& .pin-button {
				display: grid;
				place-items: center;
				padding: 4px;
				border: 1px solid var(--fg-border);
				border-radius: 6px;
				background: transparent;
				color: var(--fg-text-muted);
				font-size: 12px;
				line-height: 1;
				cursor: pointer;
				opacity: 0.5;
				&[data-pinned] {
					border-color: var(--fg-primary);
					color: var(--fg-primary);
					opacity: 1;
				}
			}
			& .nutrient-snapshot {
				display: grid;
				gap: 6px;
				padding: 10px;
				border: 1px dashed var(--fg-border);
				border-radius: 8px;
				background: var(--fg-bg);
			}
			& .nutrient-snapshot-title {
				font-size: 10px;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.06em;
				color: var(--fg-text-muted);
			}
			& .nutrient-snapshot-grid {
				display: grid;
				grid-template-columns: repeat(3, minmax(0, 1fr));
				gap: 6px;
			}
			& .nutrient-pill {
				display: grid;
				gap: 2px;
				padding: 6px 8px;
				border: 1px solid var(--fg-border);
				border-radius: 6px;
				background: var(--fg-surface-soft);
				&[data-empty] {
					opacity: 0.5;
				}
				& .nutrient-pill-label {
					font-size: 10px;
					color: var(--fg-text-muted);
					text-transform: capitalize;
				}
				& .nutrient-pill-value {
					font-size: 13px;
					font-weight: 500;
					color: var(--fg-text);
				}
			}
			& p {
				margin: 0;
				color: var(--fg-text-muted);
				font-size: 13px;
			}
		}
		.editor-tabs {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 6px;
			& .editor-tab {
				padding: 7px 8px;
				border: 1px solid var(--fg-border);
				border-radius: 6px;
				background: var(--fg-bg);
				color: var(--fg-text-muted);
				font-size: 12px;
				cursor: pointer;
			}
			& .editor-tab[data-active] {
				border-color: var(--fg-primary);
				background: var(--fg-primary-soft);
				color: var(--fg-primary);
			}
		}
		.usage-section {
			& .usage-columns {
				display: grid;
				grid-template-columns: 1fr 1fr;
				gap: 8px;
				& ul {
					margin: 6px 0 0;
					padding-left: 16px;
				}
			}
		}
		.editor-actions {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			gap: 8px;
			& .save-error {
				flex: 1;
				font-size: 12px;
				color: var(--fg-error, #e05252);
			}
			& button {
				padding: 8px 10px;
				border: 1px solid var(--fg-primary);
				border-radius: 6px;
				background: var(--fg-primary-soft);
				color: var(--fg-primary);
			}
		}
		.category-section {
			display: grid;
			gap: 10px;
			padding: 8px 0 12px;
			border-bottom: 1px solid var(--fg-border);
			background: transparent;
		}
		.category-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			& span {
				font-size: 12px;
				color: var(--fg-text-muted);
			}
		}
		.tile-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(92px, 92px));
			gap: 10px;
			min-height: 104px;
		}
		.ingredient-tile {
			position: relative;
			display: grid;
			grid-template-rows: minmax(68px, 1fr) auto;
			align-items: stretch;
			width: 100%;
			min-height: 112px;
			padding: 0;
			border: 1px solid var(--fg-border);
			border-radius: 8px;
			background: var(--fg-surface-soft);
			overflow: hidden;
			& .tile-handle {
				position: absolute;
				top: 1px;
				left: 1px;
				display: grid;
				place-items: center;
				width: 22px;
				height: 22px;
				padding: 0;
				border: 1px solid var(--fg-border);
				border-top: none;
				border-left: none;
				border-radius: 0 0 6px 0;
				background: color-mix(in srgb, var(--fg-bg) 75%, transparent);
				color: var(--fg-text-muted);
				font-size: 16px;
				line-height: 1;
				cursor: pointer;
			}
			& .tile-image {
				display: grid;
				align-items: center;
				justify-items: center;
				width: 100%;
				min-height: 68px;
				padding: 6px 0;
				background: color-mix(in srgb, var(--fg-bg) 60%, var(--fg-surface-soft));
			}
			& .icon {
				font-size: 30px;
				line-height: 1;
			}
			& .tile-label {
				display: block;
				width: 100%;
				align-self: end;
				padding: 6px 6px 7px;
				font-size: 11px;
				line-height: 1.2;
				color: var(--fg-text-muted);
				text-align: center;
				text-wrap: balance;
			}
			& .hover-card {
				position: absolute;
				position-area: top center;
				z-index: 10;
				width: 220px;
				padding: 10px;
				border: 1px solid var(--fg-border);
				border-radius: 10px;
				background: var(--fg-surface);
				box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
				inset: unset;
				margin: 0 0 8px;
				color: var(--fg-text);
				& p {
					margin: 4px 0 0;
					font-size: 12px;
					color: var(--fg-text-muted);
				}
				& .tag-list {
					display: flex;
					flex-wrap: wrap;
					gap: 4px;
					margin-top: 8px;
					& span {
						padding: 2px 6px;
						border-radius: 999px;
						background: var(--fg-primary-soft);
						font-size: 11px;
						color: var(--fg-primary);
					}
				}
			}
		}
		.hover-card:popover-open {
			display: block;
		}
		.move-menu {
			position: absolute;
			position-area: bottom span-right;
			z-index: 12;
			display: none;
			gap: 4px;
			width: 180px;
			padding: 6px;
			border: 1px solid var(--fg-border);
			border-radius: 8px;
			background: var(--fg-surface);
			box-shadow: 0 10px 22px rgba(0, 0, 0, 0.4);
			inset: unset;
			margin: 6px 0 0;
			& .move-option {
				display: block;
				width: 100%;
				padding: 7px 8px;
				border: 1px solid transparent;
				border-radius: 6px;
				background: transparent;
				color: var(--fg-text);
				font-size: 12px;
				text-align: left;
				cursor: pointer;
			}
			& .move-option:hover,
			& .move-option:focus-visible {
				border-color: var(--fg-primary-soft);
				background: var(--fg-primary-soft);
				outline: none;
			}
		}
		.move-menu:popover-open {
			display: grid;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'ingredients-page': IngredientsPage;
	}
}
