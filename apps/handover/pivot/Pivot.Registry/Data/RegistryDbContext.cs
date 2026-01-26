using Microsoft.EntityFrameworkCore;
using Pivot.Registry.Models;

namespace Pivot.Registry.Data;

public class RegistryDbContext : DbContext {
	public RegistryDbContext(DbContextOptions<RegistryDbContext> options) : base(options) {
	}

	public DbSet<Models.Plugin> Plugins => Set<Models.Plugin>();
	public DbSet<PluginVersion> PluginVersions => Set<PluginVersion>();
	public DbSet<PluginDependency> PluginDependencies => Set<PluginDependency>();

	protected override void OnModelCreating(ModelBuilder modelBuilder) {
		base.OnModelCreating(modelBuilder);

		modelBuilder.Entity<Models.Plugin>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Name).IsUnique();
			entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
			entity.Property(e => e.Description).HasMaxLength(500);
			entity.Property(e => e.Author).HasMaxLength(100);
			entity.Property(e => e.Tags).HasMaxLength(200);
		});

		modelBuilder.Entity<PluginVersion>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PluginId, e.Version }).IsUnique();
			entity.Property(e => e.Version).IsRequired().HasMaxLength(50);
			entity.Property(e => e.ManifestJson).IsRequired();
			entity.Property(e => e.StorageKey).IsRequired().HasMaxLength(200);

			entity.HasOne(e => e.Plugin)
				 .WithMany(p => p.Versions)
				 .HasForeignKey(e => e.PluginId)
				 .OnDelete(DeleteBehavior.Cascade);
		});

		modelBuilder.Entity<PluginDependency>(entity => {
			entity.HasKey(e => e.Id);
			entity.Property(e => e.DependencyName).IsRequired().HasMaxLength(100);
			entity.Property(e => e.VersionRange).IsRequired().HasMaxLength(50);

			entity.HasOne(e => e.PluginVersion)
				 .WithMany(pv => pv.Dependencies)
				 .HasForeignKey(e => e.PluginVersionId)
				 .OnDelete(DeleteBehavior.Cascade);
		});
	}
}
