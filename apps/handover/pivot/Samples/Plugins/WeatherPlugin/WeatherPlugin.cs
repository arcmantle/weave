using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Pivot.Plugin;

namespace WeatherPlugin;

/// <summary>
/// Weather forecast model
/// </summary>
public class WeatherForecast
{
	public DateTime Date { get; set; }
	public int TemperatureC { get; set; }
	public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
	public required string Summary { get; set; }
}

/// <summary>
/// Plugin providing weather forecast data
/// </summary>
public class WeatherPlugin : IPlugin
{
	private static readonly string[] Summaries = new[]
	{
		"Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
	};

	public string Name => "Weather";

	public void Initialize(WebApplicationBuilder builder)
	{
		// No services needed for this simple example
	}

	public void Configure(WebApplication app)
	{
		var weather = app.MapGroup("/api/weather")
			.WithTags("Weather")
			.WithOpenApi();

		weather.MapGet("/forecast", () =>
		{
			var forecast = Enumerable.Range(1, 5).Select(index => new WeatherForecast
			{
				Date = DateTime.Now.AddDays(index),
				TemperatureC = Random.Shared.Next(-20, 55),
				Summary = Summaries[Random.Shared.Next(Summaries.Length)]
			}).ToArray();

			return Results.Ok(forecast);
		})
		.WithName("GetWeatherForecast")
		.WithSummary("Get 5-day weather forecast")
		.WithDescription("Returns a randomly generated 5-day weather forecast");

		weather.MapGet("/current", () =>
		{
			var current = new WeatherForecast
			{
				Date = DateTime.Now,
				TemperatureC = Random.Shared.Next(-20, 55),
				Summary = Summaries[Random.Shared.Next(Summaries.Length)]
			};

			return Results.Ok(current);
		})
		.WithName("GetCurrentWeather")
		.WithSummary("Get current weather")
		.WithDescription("Returns randomly generated current weather data");
	}
}
