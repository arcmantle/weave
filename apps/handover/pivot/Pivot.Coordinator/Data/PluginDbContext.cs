using Microsoft.EntityFrameworkCore;
using Pivot.Plugin;

namespace Pivot.Coordinator.Data;


/// <summary>
/// Database context for plugin state management
/// </summary>
public class PluginDbContext : DbContext {
	public PluginDbContext(DbContextOptions<PluginDbContext> options) : base(options) {
	}

	public DbSet<PluginState> Plugins => Set<PluginState>();

	protected override void OnModelCreating(ModelBuilder modelBuilder) {
		base.OnModelCreating(modelBuilder);

		modelBuilder.Entity<PluginState>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Name).IsUnique();
			entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
			entity.Property(e => e.IsEnabled).HasDefaultValue(true);
			entity.Property(e => e.LastModified).HasDefaultValueSql("CURRENT_TIMESTAMP");
			entity.Property(e => e.InstalledVersion).HasMaxLength(50);
			entity.Property(e => e.RegistryUrl).HasMaxLength(500);
		});
	}
}
