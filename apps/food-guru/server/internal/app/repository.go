package app

import "context"

type Repository interface {
	Init(ctx context.Context) error
	GetState(ctx context.Context, tenantID string) (FoodGuruState, error)
	AddMeal(ctx context.Context, tenantID string, input AddMealInput) (MealPlanItem, error)
	ToggleMealComplete(ctx context.Context, tenantID string, mealID string) (MealPlanItem, error)
	AddIngredient(ctx context.Context, tenantID string, input AddIngredientInput) (IngredientItem, error)
	ToggleIngredientStock(ctx context.Context, tenantID string, ingredientID string) (IngredientItem, error)
	UpdateSettings(ctx context.Context, tenantID string, settings Settings) (Settings, error)
}
