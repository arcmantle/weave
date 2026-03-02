package app

import (
	"context"
	"sync"
)

type inMemoryTenantState struct {
	meals           map[string]MealPlanItem
	mealOrder       []string
	ingredients     map[string]IngredientItem
	ingredientOrder []string
	settings        Settings
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

func (repository *InMemoryRepository) GetState(_ context.Context, tenantID string) (FoodGuruState, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))

	meals := make([]MealPlanItem, 0, len(tenant.mealOrder))
	for _, mealID := range tenant.mealOrder {
		meal, exists := tenant.meals[mealID]
		if !exists {
			continue
		}

		meals = append(meals, meal)
	}

	ingredients := make([]IngredientItem, 0, len(tenant.ingredientOrder))
	for _, ingredientID := range tenant.ingredientOrder {
		ingredient, exists := tenant.ingredients[ingredientID]
		if !exists {
			continue
		}

		ingredients = append(ingredients, ingredient)
	}

	return FoodGuruState{
		MealPlans:   meals,
		Ingredients: ingredients,
		Settings:    tenant.settings,
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

func (repository *InMemoryRepository) AddIngredient(_ context.Context, tenantID string, input AddIngredientInput) (IngredientItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))

	ingredient := IngredientItem{
		ID:       newID("i"),
		Name:     input.Name,
		Quantity: input.Quantity,
		InStock:  true,
	}

	tenant.ingredients[ingredient.ID] = ingredient
	tenant.ingredientOrder = append(tenant.ingredientOrder, ingredient.ID)

	return ingredient, nil
}

func (repository *InMemoryRepository) ToggleIngredientStock(_ context.Context, tenantID string, ingredientID string) (IngredientItem, error) {
	repository.mu.Lock()
	defer repository.mu.Unlock()

	tenant := repository.ensureTenant(normalizeTenantID(tenantID))
	ingredient, exists := tenant.ingredients[ingredientID]
	if !exists {
		return IngredientItem{}, ErrNotFound
	}

	ingredient.InStock = !ingredient.InStock
	tenant.ingredients[ingredientID] = ingredient

	return ingredient, nil
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
		meals:           make(map[string]MealPlanItem),
		mealOrder:       make([]string, 0),
		ingredients:     make(map[string]IngredientItem),
		ingredientOrder: make([]string, 0),
		settings: Settings{
			DailyCalorieGoal:   2000,
			ShowCompletedMeals: true,
		},
	}

	repository.tenants[tenantID] = tenant

	return tenant
}
