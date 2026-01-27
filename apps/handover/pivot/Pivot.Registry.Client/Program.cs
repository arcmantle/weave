using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Pivot.Registry.Client;
using Pivot.Registry.Client.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// Register AuthenticationService first (needed by AuthenticationHandler)
builder.Services.AddScoped<AuthenticationService>();

// Register AuthenticationHandler
builder.Services.AddTransient<AuthenticationHandler>();

// Register HttpClient with the AuthenticationHandler in the pipeline
builder.Services.AddHttpClient("API", client =>
	client.BaseAddress = new Uri(builder.HostEnvironment.BaseAddress))
	.AddHttpMessageHandler<AuthenticationHandler>();

// Register the default HttpClient to use the named client
builder.Services.AddScoped(sp =>
	sp.GetRequiredService<IHttpClientFactory>().CreateClient("API"));

await builder.Build().RunAsync();
