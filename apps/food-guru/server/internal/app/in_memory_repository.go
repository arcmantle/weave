package app

import (
	"context"
	"strings"
	"sync"
)

type inMemoryIngredientState struct {
	categories            map[string]IngredientCategory
	categoryOrder         []string
	ingredients           map[string]IngredientItem
	categoryIngredientIDs map[string][]string
	dishes                map[string]DishItem
	dishOrder             []string
	unassignedCategoryID  string
}

type inMemoryTenantState struct {
	meals           map[string]MealPlanItem
	mealOrder       []string
	settings        Settings
	ingredientUsers map[string]*inMemoryIngredientState
}

type InMemoryRepository struct {
	mu      sync.RWMutex
	tenants map[string]*inMemoryTenantState
}

var _ Repository = (*InMemoryRepository)(nil)

func NewInMemoryRepository() *InMemoryRepository {
	return &InMemoryRepository{
		tenants: make(map[string]*inMemoryTenantState),
	}
}

func (repository *InMemoryRepository) Init(_ context.Context) error {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	repository.ensureTenant(DefaultTenantID)

	return nil
}

func (repository *InMemoryRepository) GetState(_ context.Context, tenantID string, userID string) (FoodGuruState, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)

	meals := make([]MealPlanItem, 0, len(tenant.mealOrder))
	for _, mealID := range tenant.mealOrder {
		meal, exists := tenant.meals[mealID]
		if !exists {
			continue
		}

		meals = append(meals, meal)
	}

	ingredients := make([]IngredientItem, 0, len(ingredientState.ingredients))
	for _, categoryID := range ingredientState.categoryOrder {
		ingredientIDs := ingredientState.categoryIngredientIDs[categoryID]
		for position, ingredientID := range ingredientIDs {
			ingredient, exists := ingredientState.ingredients[ingredientID]
			if !exists {
				continue
			}

			ingredient.IngredientOrder = position
			ingredients = append(ingredients, ingredient)
		}
	}

	categories := make([]IngredientCategory, 0, len(ingredientState.categoryOrder))
	for position, categoryID := range ingredientState.categoryOrder {
		category, exists := ingredientState.categories[categoryID]
		if !exists {
			continue
		}

		category.CategoryOrder = position
		categories = append(categories, category)
	}

	return FoodGuruState{
		MealPlans:            meals,
		Ingredients:          ingredients,
		IngredientCategories: categories,
		UnassignedCategoryID: ingredientState.unassignedCategoryID,
		Settings:             tenant.settings,
	}, nil
}

func (repository *InMemoryRepository) AddMeal(_ context.Context, tenantID string, input AddMealInput) (MealPlanItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))

	meal := MealPlanItem{
		ID:        newID("m"),
		Day:       input.Day,
		Name:      input.Name,
		Calories:  input.Calories,
		Completed: false,
	}

	tenant.meals[meal.ID] = meal
	tenant.mealOrder = append(tenant.mealOrder, meal.ID)

	return meal, nil
}

func (repository *InMemoryRepository) ToggleMealComplete(_ context.Context, tenantID string, mealID string) (MealPlanItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	meal, exists := tenant.meals[mealID]
	if !exists {
		return MealPlanItem{}, ErrNotFound
	}

	meal.Completed = !meal.Completed
	tenant.meals[mealID] = meal

	return meal, nil
}

func (repository *InMemoryRepository) AddIngredient(_ context.Context, tenantID string, userID string, input AddIngredientInput) (IngredientItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	categoryID := normalizeCategoryID(input.CategoryID, ingredientState.unassignedCategoryID)
	if _, exists := ingredientState.categories[categoryID]; !exists {
		categoryID = ingredientState.unassignedCategoryID
	}

	tags := sanitizeTags(input.Tags)
	position := len(ingredientState.categoryIngredientIDs[categoryID])

	ingredient := IngredientItem{
		ID:              newID("i"),
		Name:            strings.TrimSpace(input.Name),
		Quantity:        strings.TrimSpace(input.Quantity),
		InStock:         true,
		CategoryID:      categoryID,
		Notes:           strings.TrimSpace(input.Notes),
		Tags:            tags,
		ImageURL:        "",
		Nutrients:       make([]NutrientEntry, 0),
		IngredientOrder: position,
	}

	ingredientState.ingredients[ingredient.ID] = ingredient
	ingredientState.categoryIngredientIDs[categoryID] = append(ingredientState.categoryIngredientIDs[categoryID], ingredient.ID)

	return ingredient, nil
}

func (repository *InMemoryRepository) ToggleIngredientStock(_ context.Context, tenantID string, userID string, ingredientID string) (IngredientItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	ingredient, exists := ingredientState.ingredients[ingredientID]
	if !exists {
		return IngredientItem{}, ErrNotFound
	}

	ingredient.InStock = !ingredient.InStock
	ingredientState.ingredients[ingredientID] = ingredient

	return ingredient, nil
}

func (repository *InMemoryRepository) UpdateIngredient(_ context.Context, tenantID string, userID string, ingredientID string, input UpdateIngredientInput) (IngredientItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	ingredient, exists := ingredientState.ingredients[ingredientID]
	if !exists {
		return IngredientItem{}, ErrNotFound
	}

	nextCategoryID := normalizeCategoryID(input.CategoryID, ingredientState.unassignedCategoryID)
	if _, categoryExists := ingredientState.categories[nextCategoryID]; !categoryExists {
		nextCategoryID = ingredientState.unassignedCategoryID
	}

	if ingredient.CategoryID != nextCategoryID {
		repository.removeIngredientFromCategory(ingredientState, ingredient.CategoryID, ingredientID)
		ingredient.CategoryID = nextCategoryID
		ingredient.IngredientOrder = len(ingredientState.categoryIngredientIDs[nextCategoryID])
		ingredientState.categoryIngredientIDs[nextCategoryID] = append(ingredientState.categoryIngredientIDs[nextCategoryID], ingredientID)
	}

	trimmedQuantity := strings.TrimSpace(input.Quantity)
	if trimmedQuantity != "" {
		ingredient.Quantity = trimmedQuantity
	}

	trimmedName := strings.TrimSpace(input.Name)
	if trimmedName != "" {
		ingredient.Name = trimmedName
	}

	ingredient.Notes = strings.TrimSpace(input.Notes)
	ingredient.Tags = sanitizeTags(input.Tags)
	ingredient.ImageURL = strings.TrimSpace(input.ImageURL)
	ingredient.Nutrients = sanitizeNutrients(input.Nutrients)
	ingredientState.ingredients[ingredientID] = ingredient

	repository.reindexCategoryIngredients(ingredientState, ingredient.CategoryID)

	return ingredientState.ingredients[ingredientID], nil
}

func (repository *InMemoryRepository) ReorderIngredients(_ context.Context, tenantID string, userID string, categoryID string, ingredientIDs []string) error {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	categoryID = normalizeCategoryID(categoryID, ingredientState.unassignedCategoryID)
	if _, exists := ingredientState.categories[categoryID]; !exists {
		return ErrNotFound
	}

	orderedIDs := make([]string, 0, len(ingredientIDs))
	seen := make(map[string]struct{}, len(ingredientIDs))
	for _, ingredientID := range ingredientIDs {
		if _, exists := seen[ingredientID]; exists {
			continue
		}

		ingredient, exists := ingredientState.ingredients[ingredientID]
		if !exists {
			continue
		}

		if ingredient.CategoryID != categoryID {
			repository.removeIngredientFromCategory(ingredientState, ingredient.CategoryID, ingredientID)
			ingredient.CategoryID = categoryID
			ingredientState.ingredients[ingredientID] = ingredient
		}

		orderedIDs = append(orderedIDs, ingredientID)
		seen[ingredientID] = struct{}{}
	}

	for _, existingID := range ingredientState.categoryIngredientIDs[categoryID] {
		if _, exists := seen[existingID]; exists {
			continue
		}
		orderedIDs = append(orderedIDs, existingID)
	}

	ingredientState.categoryIngredientIDs[categoryID] = orderedIDs
	repository.reindexCategoryIngredients(ingredientState, categoryID)

	return nil
}

func (repository *InMemoryRepository) GetIngredientUsage(_ context.Context, tenantID string, userID string, ingredientID string) (IngredientUsage, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	if _, exists := ingredientState.ingredients[ingredientID]; !exists {
		return IngredientUsage{}, ErrNotFound
	}

	dishes := make([]DishItem, 0)
	for _, dishID := range ingredientState.dishOrder {
		dish, exists := ingredientState.dishes[dishID]
		if !exists {
			continue
		}

		for _, linkedIngredientID := range dish.IngredientIDs {
			if linkedIngredientID != ingredientID {
				continue
			}

			dishes = append(dishes, dish)
			break
		}
	}

	return IngredientUsage{
		MealPlans: make([]MealPlanItem, 0),
		Dishes:    dishes,
	}, nil
}

func (repository *InMemoryRepository) UpsertDish(_ context.Context, tenantID string, userID string, dishID string, input UpsertDishInput) (DishItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return DishItem{}, ErrInvalid
	}

	nextIngredientIDs := sanitizeIngredientIDs(input.IngredientIDs)
	for _, ingredientID := range nextIngredientIDs {
		if _, exists := ingredientState.ingredients[ingredientID]; !exists {
			return DishItem{}, ErrInvalid
		}
	}

	normalizedDishID := strings.TrimSpace(dishID)
	if normalizedDishID == "" {
		normalizedDishID = newID("d")
	}

	existing, exists := ingredientState.dishes[normalizedDishID]
	if !exists {
		existing = DishItem{
			ID:            normalizedDishID,
			DishOrder:     len(ingredientState.dishOrder),
			IngredientIDs: make([]string, 0),
		}
		ingredientState.dishOrder = append(ingredientState.dishOrder, normalizedDishID)
	}

	existing.Name = name
	existing.Notes = strings.TrimSpace(input.Notes)
	existing.IngredientIDs = nextIngredientIDs
	ingredientState.dishes[normalizedDishID] = existing

	return existing, nil
}

func (repository *InMemoryRepository) ListDishes(_ context.Context, tenantID string, userID string) ([]DishItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)

	dishes := make([]DishItem, 0, len(ingredientState.dishOrder))
	for _, dishID := range ingredientState.dishOrder {
		dish, exists := ingredientState.dishes[dishID]
		if !exists {
			continue
		}

		dishes = append(dishes, dish)
	}

	return dishes, nil
}

func (repository *InMemoryRepository) AddIngredientCategory(_ context.Context, tenantID string, userID string, input AddIngredientCategoryInput) (IngredientCategory, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return IngredientCategory{}, ErrInvalid
	}

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)

	category := IngredientCategory{
		ID:            newID("c"),
		Name:          name,
		CategoryOrder: len(ingredientState.categoryOrder),
		IsSystem:      false,
	}

	ingredientState.categories[category.ID] = category
	ingredientState.categoryOrder = append(ingredientState.categoryOrder, category.ID)
	ingredientState.categoryIngredientIDs[category.ID] = make([]string, 0)

	return category, nil
}

func (repository *InMemoryRepository) UpdateIngredientCategory(_ context.Context, tenantID string, userID string, categoryID string, input UpdateIngredientCategoryInput) (IngredientCategory, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	category, exists := ingredientState.categories[categoryID]
	if !exists {
		return IngredientCategory{}, ErrNotFound
	}

	if category.IsSystem {
		return IngredientCategory{}, ErrInvalid
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return IngredientCategory{}, ErrInvalid
	}

	category.Name = name
	ingredientState.categories[categoryID] = category

	return category, nil
}

func (repository *InMemoryRepository) DeleteIngredientCategory(_ context.Context, tenantID string, userID string, categoryID string) error {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)
	category, exists := ingredientState.categories[categoryID]
	if !exists {
		return ErrNotFound
	}

	if category.IsSystem {
		return ErrInvalid
	}

	for _, ingredientID := range ingredientState.categoryIngredientIDs[categoryID] {
		ingredient, ingredientExists := ingredientState.ingredients[ingredientID]
		if !ingredientExists {
			continue
		}

		ingredient.CategoryID = ingredientState.unassignedCategoryID
		ingredientState.ingredients[ingredientID] = ingredient
		ingredientState.categoryIngredientIDs[ingredientState.unassignedCategoryID] = append(
			ingredientState.categoryIngredientIDs[ingredientState.unassignedCategoryID],
			ingredientID,
		)
	}

	delete(ingredientState.categories, categoryID)
	delete(ingredientState.categoryIngredientIDs, categoryID)
	ingredientState.categoryOrder = removeString(ingredientState.categoryOrder, categoryID)

	repository.reindexCategoryIngredients(ingredientState, ingredientState.unassignedCategoryID)
	repository.reindexCategories(ingredientState)

	return nil
}

func (repository *InMemoryRepository) ReorderIngredientCategories(_ context.Context, tenantID string, userID string, categoryIDs []string) error {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredientState := repository.ensureIngredientState(tenant, userID)

	nextOrder := make([]string, 0, len(ingredientState.categoryOrder))
	seen := make(map[string]struct{}, len(categoryIDs))
	for _, categoryID := range categoryIDs {
		category, exists := ingredientState.categories[categoryID]
		if !exists {
			continue
		}

		if category.IsSystem {
			continue
		}

		nextOrder = append(nextOrder, categoryID)
		seen[categoryID] = struct{}{}
	}

	for _, existingID := range ingredientState.categoryOrder {
		if existingID == ingredientState.unassignedCategoryID {
			continue
		}

		if _, exists := seen[existingID]; exists {
			continue
		}

		nextOrder = append(nextOrder, existingID)
	}

	nextOrder = append(nextOrder, ingredientState.unassignedCategoryID)
	ingredientState.categoryOrder = nextOrder
	repository.reindexCategories(ingredientState)

	return nil
}

func (repository *InMemoryRepository) UpdateSettings(_ context.Context, tenantID string, settings Settings) (Settings, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	tenant.settings = settings

	return settings, nil
}

func (repository *InMemoryRepository) ensureTenant(tenantID string) *inMemoryTenantState {
	tenant, exists := repository.tenants[tenantID]
	if exists {
		return tenant
	}

	tenant = &inMemoryTenantState{
		meals:     make(map[string]MealPlanItem),
		mealOrder: make([]string, 0),
		settings: Settings{
			DailyCalorieGoal:   2000,
			ShowCompletedMeals: true,
		},
		ingredientUsers: make(map[string]*inMemoryIngredientState),
	}

	repository.tenants[tenantID] = tenant

	return tenant
}

func (repository *InMemoryRepository) ensureIngredientState(tenant *inMemoryTenantState, userID string) *inMemoryIngredientState {
	normalizedUserID := normalizeUserID(userID)
	state, exists := tenant.ingredientUsers[normalizedUserID]
	if exists {
		return state
	}

	unassignedCategoryID := newID("c")
	unassignedCategory := IngredientCategory{
		ID:            unassignedCategoryID,
		Name:          "Unassigned",
		CategoryOrder: 0,
		IsSystem:      true,
	}

	state = &inMemoryIngredientState{
		categories: map[string]IngredientCategory{
			unassignedCategoryID: unassignedCategory,
		},
		categoryOrder:         []string{unassignedCategoryID},
		ingredients:           make(map[string]IngredientItem),
		categoryIngredientIDs: map[string][]string{unassignedCategoryID: make([]string, 0)},
		dishes:                make(map[string]DishItem),
		dishOrder:             make([]string, 0),
		unassignedCategoryID:  unassignedCategoryID,
	}

	tenant.ingredientUsers[normalizedUserID] = state

	return state
}

func (repository *InMemoryRepository) removeIngredientFromCategory(ingredientState *inMemoryIngredientState, categoryID string, ingredientID string) {
	if categoryID == "" {
		return
	}

	next := make([]string, 0, len(ingredientState.categoryIngredientIDs[categoryID]))
	for _, id := range ingredientState.categoryIngredientIDs[categoryID] {
		if id == ingredientID {
			continue
		}

		next = append(next, id)
	}

	ingredientState.categoryIngredientIDs[categoryID] = next
	repository.reindexCategoryIngredients(ingredientState, categoryID)
}

func (repository *InMemoryRepository) reindexCategoryIngredients(ingredientState *inMemoryIngredientState, categoryID string) {
	for index, ingredientID := range ingredientState.categoryIngredientIDs[categoryID] {
		ingredient, exists := ingredientState.ingredients[ingredientID]
		if !exists {
			continue
		}

		ingredient.IngredientOrder = index
		ingredientState.ingredients[ingredientID] = ingredient
	}
}

func (repository *InMemoryRepository) reindexCategories(ingredientState *inMemoryIngredientState) {
	for index, categoryID := range ingredientState.categoryOrder {
		category, exists := ingredientState.categories[categoryID]
		if !exists {
			continue
		}

		category.CategoryOrder = index
		ingredientState.categories[categoryID] = category
	}
}

func removeString(values []string, target string) []string {
	next := make([]string, 0, len(values))
	for _, value := range values {
		if value == target {
			continue
		}

		next = append(next, value)
	}

	return next
}

func normalizeCategoryID(categoryID string, defaultCategoryID string) string {
	normalized := strings.TrimSpace(categoryID)
	if normalized == "" {
		return defaultCategoryID
	}

	return normalized
}

func normalizeUserID(userID string) string {
	normalized := strings.TrimSpace(userID)
	if normalized == "" {
		return DefaultUserID
	}

	return normalized
}
