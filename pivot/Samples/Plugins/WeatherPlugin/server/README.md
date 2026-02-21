# WeatherPlugin — Server

## Architecture

The server component exposes two minimal API endpoints under `/api/weather`.
Weather data is randomly generated in-memory — no database or external service required.

## Models

### `WeatherForecast`

| Property       | Type       | Description                              |
| -------------- | ---------- | ---------------------------------------- |
| `Date`         | `DateTime` | Forecast date                            |
| `TemperatureC` | `int`      | Temperature in Celsius (-20 to 55)       |
| `TemperatureF` | `int`      | Computed from Celsius                    |
| `Summary`      | `string`   | Random descriptor (Freezing → Scorching) |

## API Endpoints

### `GET /api/weather/forecast`

Returns a 5-day forecast array.

### `GET /api/weather/current`

Returns a single current weather snapshot.

## Configuration

No configuration required. This plugin has no dependencies and runs standalone.
