using Microsoft.EntityFrameworkCore;

namespace ApiExample.Data;

/// <summary>
/// Database context for plugin state persistence
/// </summary>
public class PluginDbContext : DbContext
{
	public PluginDbContext(DbContextOptions<PluginDbContext> options) : base(options)
	{
	}

	public DbSet<PluginState> Plugins => Set<PluginState>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		modelBuilder.Entity<PluginState>(entity =>
		{
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Name).IsUnique();
			entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
		});
	}
}
