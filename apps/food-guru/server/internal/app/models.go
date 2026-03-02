package app

import "errors"

var ErrNotFound = errors.New("not found")

const DefaultTenantID = "default"

type MealPlanItem struct {
	ID        string `json:"id"`
	Day       string `json:"day"`
	Name      string `json:"name"`
	Calories  int    `json:"calories"`
	Completed bool   `json:"completed"`
}

type IngredientItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Quantity string `json:"quantity"`
	InStock  bool   `json:"inStock"`
}

type Settings struct {
	DailyCalorieGoal   int  `json:"dailyCalorieGoal"`
	ShowCompletedMeals bool `json:"showCompletedMeals"`
}

type FoodGuruState struct {
	MealPlans   []MealPlanItem   `json:"mealPlans"`
	Ingredients []IngredientItem `json:"ingredients"`
	Settings    Settings         `json:"settings"`
}

type AddMealInput struct {
	Day      string
	Name     string
	Calories int
}

type AddIngredientInput struct {
	Name     string
	Quantity string
}
