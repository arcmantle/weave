# WeatherPlugin

A sample Pivot plugin that provides weather forecast data via a REST API.

## Endpoints

| Method | Path                    | Description                                         |
| ------ | ----------------------- | --------------------------------------------------- |
| `GET`  | `/api/weather/forecast` | Returns a randomly generated 5-day weather forecast |
| `GET`  | `/api/weather/current`  | Returns randomly generated current weather data     |

## Response Format

```json
{
  "date": "2026-02-12T00:00:00",
  "temperatureC": 25,
  "temperatureF": 76,
  "summary": "Warm"
}
```

## Dependencies

- **Newtonsoft.Json** `13.0.3` — JSON serialization

## Usage

This is a standalone plugin with no plugin dependencies. It can be installed independently.

> **Note:** Temperature data is randomly generated and does not represent real weather conditions.
