using Microsoft.AspNetCore.Builder;

namespace Pivot.Plugin;


public interface IPlugin
{
	string Name { get; }
	void Initialize(WebApplicationBuilder builder);
	void Configure(WebApplication app);
}
