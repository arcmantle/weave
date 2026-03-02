package app

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (repository *SQLiteRepository) Init(ctx context.Context) error {
	if err := repository.migrateSettingsTable(ctx); err != nil {
		return err
	}

	statements := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`INSERT INTO tenants(id, name)
			SELECT 'default', 'Default Tenant'
			WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'default');`,
		`CREATE TABLE IF NOT EXISTS meal_plans (
			id TEXT PRIMARY KEY,
			day TEXT NOT NULL,
			name TEXT NOT NULL,
			calories INTEGER NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0
		);`,
		`ALTER TABLE meal_plans ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`,
		`CREATE INDEX IF NOT EXISTS idx_meal_plans_tenant_id ON meal_plans(tenant_id);`,
		`CREATE TABLE IF NOT EXISTS ingredients (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			quantity TEXT NOT NULL,
			in_stock INTEGER NOT NULL DEFAULT 1
		);`,
		`ALTER TABLE ingredients ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`,
		`CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);`,
		`CREATE TABLE IF NOT EXISTS settings (
			tenant_id TEXT PRIMARY KEY,
			daily_calorie_goal INTEGER NOT NULL,
			show_completed_meals INTEGER NOT NULL,
			FOREIGN KEY(tenant_id) REFERENCES tenants(id)
		);`,
		`INSERT OR IGNORE INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			VALUES('default', 2000, 1);`,
	}

	for _, statement := range statements {
		_, err := repository.db.ExecContext(ctx, statement)
		if err != nil {
			if strings.Contains(statement, "ALTER TABLE") && strings.Contains(err.Error(), "duplicate column name") {
				continue
			}

			return err
		}
	}

	return nil
}

func (repository *SQLiteRepository) migrateSettingsTable(ctx context.Context) error {
	rows, err := repository.db.QueryContext(ctx, `PRAGMA table_info(settings);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasRows := false
	hasTenantID := false

	for rows.Next() {
		hasRows = true
		var cid int
		var name string
		var dataType string
		var notNull int
		var defaultValue sql.NullString
		var pk int

		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}

		if name == "tenant_id" {
			hasTenantID = true
		}
	}

	if !hasRows || hasTenantID {
		return nil
	}

	tx, err := repository.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `ALTER TABLE settings RENAME TO settings_legacy;`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `
		CREATE TABLE settings (
			tenant_id TEXT PRIMARY KEY,
			daily_calorie_goal INTEGER NOT NULL,
			show_completed_meals INTEGER NOT NULL
		);
	`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `
		INSERT INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			SELECT 'default', daily_calorie_goal, show_completed_meals
			FROM settings_legacy
			LIMIT 1;
	`); err != nil {
		return err
	}

	if _, err = tx.ExecContext(ctx, `DROP TABLE settings_legacy;`); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (repository *SQLiteRepository) GetState(ctx context.Context, tenantID string) (FoodGuruState, error) {
	tenantID = normalizeTenantID(tenantID)

	mealRows, err := repository.db.QueryContext(ctx,
		`SELECT id, day, name, calories, completed
			FROM meal_plans
			WHERE tenant_id = ?
			ORDER BY rowid;`,
		tenantID,
	)
	if err != nil {
		return FoodGuruState{}, err
	}
	defer mealRows.Close()

	meals := make([]MealPlanItem, 0)
	for mealRows.Next() {
		var meal MealPlanItem
		var completed int
		if err := mealRows.Scan(&meal.ID, &meal.Day, &meal.Name, &meal.Calories, &completed); err != nil {
			return FoodGuruState{}, err
		}
		meal.Completed = completed == 1
		meals = append(meals, meal)
	}

	ingredientRows, err := repository.db.QueryContext(ctx,
		`SELECT id, name, quantity, in_stock
			FROM ingredients
			WHERE tenant_id = ?
			ORDER BY rowid;`,
		tenantID,
	)
	if err != nil {
		return FoodGuruState{}, err
	}
	defer ingredientRows.Close()

	ingredients := make([]IngredientItem, 0)
	for ingredientRows.Next() {
		var ingredient IngredientItem
		var inStock int
		if err := ingredientRows.Scan(&ingredient.ID, &ingredient.Name, &ingredient.Quantity, &inStock); err != nil {
			return FoodGuruState{}, err
		}
		ingredient.InStock = inStock == 1
		ingredients = append(ingredients, ingredient)
	}

	settings := Settings{}
	var showCompletedMeals int
	err = repository.db.QueryRowContext(
		ctx,
		`SELECT daily_calorie_goal, show_completed_meals FROM settings WHERE tenant_id = ?;`,
		tenantID,
	).Scan(&settings.DailyCalorieGoal, &showCompletedMeals)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if _, upsertErr := repository.db.ExecContext(
				ctx,
				`INSERT OR IGNORE INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
					VALUES(?, 2000, 1);`,
				tenantID,
			); upsertErr != nil {
				return FoodGuruState{}, upsertErr
			}

			settings = Settings{
				DailyCalorieGoal:   2000,
				ShowCompletedMeals: true,
			}

			return FoodGuruState{
				MealPlans:   meals,
				Ingredients: ingredients,
				Settings:    settings,
			}, nil
		}

		return FoodGuruState{}, err
	}
	settings.ShowCompletedMeals = showCompletedMeals == 1

	return FoodGuruState{
		MealPlans:   meals,
		Ingredients: ingredients,
		Settings:    settings,
	}, nil
}

func (repository *SQLiteRepository) AddMeal(ctx context.Context, tenantID string, input AddMealInput) (MealPlanItem, error) {
	tenantID = normalizeTenantID(tenantID)

	item := MealPlanItem{
		ID:        newID("m"),
		Day:       strings.TrimSpace(input.Day),
		Name:      strings.TrimSpace(input.Name),
		Calories:  input.Calories,
		Completed: false,
	}

	_, err := repository.db.ExecContext(
		ctx,
		`INSERT INTO meal_plans(id, tenant_id, day, name, calories, completed)
			VALUES(?, ?, ?, ?, ?, 0);`,
		item.ID,
		tenantID,
		item.Day,
		item.Name,
		item.Calories,
	)
	if err != nil {
		return MealPlanItem{}, err
	}

	return item, nil
}

func (repository *SQLiteRepository) ToggleMealComplete(ctx context.Context, tenantID string, mealID string) (MealPlanItem, error) {
	tenantID = normalizeTenantID(tenantID)

	row := repository.db.QueryRowContext(
		ctx,
		`SELECT day, name, calories, completed
			FROM meal_plans
			WHERE id = ? AND tenant_id = ?;`,
		mealID,
		tenantID,
	)

	item := MealPlanItem{ID: mealID}
	var completed int
	if err := row.Scan(&item.Day, &item.Name, &item.Calories, &completed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return MealPlanItem{}, ErrNotFound
		}

		return MealPlanItem{}, err
	}

	nextCompleted := 1
	if completed == 1 {
		nextCompleted = 0
	}

	if _, err := repository.db.ExecContext(
		ctx,
		`UPDATE meal_plans
			SET completed = ?
			WHERE id = ? AND tenant_id = ?;`,
		nextCompleted,
		mealID,
		tenantID,
	); err != nil {
		return MealPlanItem{}, err
	}

	item.Completed = nextCompleted == 1

	return item, nil
}

func (repository *SQLiteRepository) AddIngredient(ctx context.Context, tenantID string, input AddIngredientInput) (IngredientItem, error) {
	tenantID = normalizeTenantID(tenantID)

	item := IngredientItem{
		ID:       newID("i"),
		Name:     strings.TrimSpace(input.Name),
		Quantity: strings.TrimSpace(input.Quantity),
		InStock:  true,
	}

	_, err := repository.db.ExecContext(
		ctx,
		`INSERT INTO ingredients(id, tenant_id, name, quantity, in_stock)
			VALUES(?, ?, ?, ?, 1);`,
		item.ID,
		tenantID,
		item.Name,
		item.Quantity,
	)
	if err != nil {
		return IngredientItem{}, err
	}

	return item, nil
}

func (repository *SQLiteRepository) ToggleIngredientStock(ctx context.Context, tenantID string, ingredientID string) (IngredientItem, error) {
	tenantID = normalizeTenantID(tenantID)

	row := repository.db.QueryRowContext(
		ctx,
		`SELECT name, quantity, in_stock
			FROM ingredients
			WHERE id = ? AND tenant_id = ?;`,
		ingredientID,
		tenantID,
	)

	item := IngredientItem{ID: ingredientID}
	var inStock int
	if err := row.Scan(&item.Name, &item.Quantity, &inStock); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return IngredientItem{}, ErrNotFound
		}

		return IngredientItem{}, err
	}

	nextInStock := 1
	if inStock == 1 {
		nextInStock = 0
	}

	if _, err := repository.db.ExecContext(
		ctx,
		`UPDATE ingredients
			SET in_stock = ?
			WHERE id = ? AND tenant_id = ?;`,
		nextInStock,
		ingredientID,
		tenantID,
	); err != nil {
		return IngredientItem{}, err
	}

	item.InStock = nextInStock == 1

	return item, nil
}

func (repository *SQLiteRepository) UpdateSettings(ctx context.Context, tenantID string, settings Settings) (Settings, error) {
	tenantID = normalizeTenantID(tenantID)

	showCompletedMeals := 0
	if settings.ShowCompletedMeals {
		showCompletedMeals = 1
	}

	_, err := repository.db.ExecContext(
		ctx,
		`INSERT INTO settings(tenant_id, daily_calorie_goal, show_completed_meals)
			VALUES(?, ?, ?)
			ON CONFLICT(tenant_id) DO UPDATE
			SET daily_calorie_goal = excluded.daily_calorie_goal,
				show_completed_meals = excluded.show_completed_meals;`,
		tenantID,
		settings.DailyCalorieGoal,
		showCompletedMeals,
	)
	if err != nil {
		return Settings{}, err
	}

	return settings, nil
}

func normalizeTenantID(tenantID string) string {
	normalized := strings.TrimSpace(tenantID)
	if normalized == "" {
		return DefaultTenantID
	}

	return normalized
}

func newID(prefix string) string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		panic(fmt.Errorf("failed generating random id: %w", err))
	}

	return prefix + "-" + hex.EncodeToString(bytes)
}
