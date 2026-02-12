using Microsoft.EntityFrameworkCore;
using Pivot.Auth.Models;

namespace Pivot.Auth.Data;


public class AuthDbContext : DbContext {

	public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) {
	}

	public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

	protected override void OnModelCreating(ModelBuilder modelBuilder) {
		base.OnModelCreating(modelBuilder);

		modelBuilder.Entity<RefreshToken>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Token).IsUnique();
			entity.HasIndex(e => e.Username);
			entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
			entity.Property(e => e.Token).IsRequired().HasMaxLength(100);
			entity.Property(e => e.ExpiresAt).IsRequired();
			entity.Property(e => e.CreatedAt).IsRequired();
		});
	}

}
