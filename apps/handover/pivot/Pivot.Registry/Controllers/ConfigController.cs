using Microsoft.AspNetCore.Mvc;

namespace Pivot.Registry.Controllers;

/// <summary>
/// Exposes registry configuration to the pre-built client (similar to how
/// Swagger exposes its config). This endpoint is always anonymous so the
/// client can bootstrap before any authentication has taken place.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase {
	private readonly RegistryOptions _options;

	public ConfigController(RegistryOptions options) {
		_options = options;
	}

	[HttpGet]
	public IActionResult GetConfig() {
		return Ok(new {
			AccessMode = _options.AccessMode.ToString().ToLowerInvariant(),
		});
	}
}
