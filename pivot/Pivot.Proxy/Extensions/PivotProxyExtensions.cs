using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pivot.Proxy;
using Pivot.Proxy.Services;
using Yarp.ReverseProxy.Configuration;

namespace Pivot.Extensions;


public static class PivotProxyExtensions
{
	public static WebApplicationBuilder AddPivotProxy(
		this WebApplicationBuilder builder,
		Action<PivotProxyOptions>? configure = null
	)
	{
		var options = new PivotProxyOptions();
		builder.Configuration.GetSection("Proxy").Bind(options);
		configure?.Invoke(options);

		builder.Services.AddSingleton(options);

		// Create YARP in-memory config provider
		var inMemoryConfig = new InMemoryConfigProvider([], []);
		builder.Services.AddSingleton<IProxyConfigProvider>(inMemoryConfig);
		builder.Services.AddReverseProxy();

		// Add coordinator client
		builder.Services.AddSingleton<CoordinatorClient>();
		builder.Services.AddHostedService(sp => sp.GetRequiredService<CoordinatorClient>());

		return builder;
	}

	public static WebApplication MapPivotProxy(this WebApplication app)
	{
		app.MapGet("/health", () => Results.Ok(new
		{
			status = "healthy",
			timestamp = DateTime.UtcNow
		}));

		app.MapReverseProxy();

		return app;
	}
}
