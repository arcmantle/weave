using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Changelog.Storage;
using Microsoft.Data.Sqlite;

namespace Changelog.Demo;

public class UserProfile {
	public string? FirstName { get; set; }
	public string? LastName { get; set; }
	public string? Email { get; set; }
	public string? Phone { get; set; }
	public Address? Address { get; set; }
	public Dictionary<string, object>? Preferences { get; set; }
	public bool IsActive { get; set; }
}

public class Address {
	public string? Street { get; set; }
	public string? City { get; set; }
	public string? State { get; set; }
	public string? ZipCode { get; set; }
	public string? Country { get; set; }
}

public class Invoice {
	public string? InvoiceNumber { get; set; }
	public string? CustomerId { get; set; }
	public DateTime IssueDate { get; set; }
	public DateTime? DueDate { get; set; }
	public List<LineItem>? Items { get; set; }
	public decimal Subtotal { get; set; }
	public decimal Tax { get; set; }
	public decimal Total { get; set; }
	public string? Status { get; set; }
	public Dictionary<string, object>? Metadata { get; set; }
}

public class LineItem {
	public string? Description { get; set; }
	public int Quantity { get; set; }
	public decimal UnitPrice { get; set; }
	public decimal Amount { get; set; }
}

class Program {
	static async Task Main(string[] args) {
		Console.WriteLine("=== Changelog Multi-Document Demo ===\n");

		// Set up SQLite database
		var dbPath = "changelog-demo.db";
		if (File.Exists(dbPath)) {
			File.Delete(dbPath);
			Console.WriteLine("Deleted existing database\n");
		}

		var connectionString = $"Data Source={dbPath}";

		// Create separate storage for each document type
		var userStorage = new SqliteStorage<UserProfile>(connectionString);
		var invoiceStorage = new SqliteStorage<Invoice>(connectionString);

		Console.WriteLine("========================================");
		Console.WriteLine("PART 1: User Profiles");
		Console.WriteLine("========================================\n");

		// Create and modify User Profile 1
		var user1 = new Changelog<UserProfile>(userStorage, "user-profile-john");
		Console.WriteLine("Creating John's profile...");
		await user1.SetDocumentAsync(new UserProfile {
			FirstName = "John",
			LastName = "Doe",
			Email = "john.doe@example.com",
			Phone = "555-0100",
			Address = new Address {
				Street = "123 Main St",
				City = "Springfield",
				State = "IL",
				ZipCode = "62701",
				Country = "USA"
			},
			Preferences = new Dictionary<string, object> {
				{ "theme", "dark" },
				{ "notifications", true },
				{ "language", "en" }
			},
			IsActive = true
		});
		Console.WriteLine("✓ John's profile created\n");

		// Modify John's profile
		await user1.BeginGroupAsync(new Dictionary<string, object> {
			{ "description", "Profile update" },
			{ "editor", "admin" }
		});
		var johnProfile = await user1.GetDocumentAsync();
		johnProfile!.Phone = "555-0199";
		johnProfile.Preferences!["notifications"] = false;
		await user1.ApplyChangesAsync(johnProfile);
		await user1.CommitGroupAsync();
		Console.WriteLine("✓ Updated John's phone and notifications\n");

		// Create and modify User Profile 2
		var user2 = new Changelog<UserProfile>(userStorage, "user-profile-jane");
		Console.WriteLine("Creating Jane's profile...");
		await user2.SetDocumentAsync(new UserProfile {
			FirstName = "Jane",
			LastName = "Smith",
			Email = "jane.smith@example.com",
			Phone = "555-0200",
			Address = new Address {
				Street = "456 Oak Ave",
				City = "Portland",
				State = "OR",
				ZipCode = "97201",
				Country = "USA"
			},
			Preferences = new Dictionary<string, object> {
				{ "theme", "light" },
				{ "notifications", true },
				{ "language", "en" }
			},
			IsActive = true
		});
		Console.WriteLine("✓ Jane's profile created\n");

		// Modify Jane's address
		await user2.BeginGroupAsync(new Dictionary<string, object> {
			{ "description", "Address change" },
			{ "editor", "jane.smith@example.com" }
		});
		var janeProfile = await user2.GetDocumentAsync();
		janeProfile!.Address!.Street = "789 Pine Blvd";
		janeProfile.Address.ZipCode = "97202";
		await user2.ApplyChangesAsync(janeProfile);
		await user2.CommitGroupAsync();
		Console.WriteLine("✓ Updated Jane's address\n");

		Console.WriteLine("========================================");
		Console.WriteLine("PART 2: Invoices");
		Console.WriteLine("========================================\n");

		// Create and modify Invoice 1
		var invoice1 = new Changelog<Invoice>(invoiceStorage, "invoice-inv-001");
		Console.WriteLine("Creating Invoice INV-001...");
		await invoice1.SetDocumentAsync(new Invoice {
			InvoiceNumber = "INV-001",
			CustomerId = "user-profile-john",
			IssueDate = DateTime.UtcNow,
			DueDate = DateTime.UtcNow.AddDays(30),
			Items = new List<LineItem> {
				new LineItem { Description = "Web Design Service", Quantity = 1, UnitPrice = 1500m, Amount = 1500m },
				new LineItem { Description = "Hosting (1 year)", Quantity = 1, UnitPrice = 120m, Amount = 120m }
			},
			Subtotal = 1620m,
			Tax = 129.60m,
			Total = 1749.60m,
			Status = "draft",
			Metadata = new Dictionary<string, object> {
				{ "project", "Website Redesign" },
				{ "paymentTerms", "Net 30" }
			}
		});
		Console.WriteLine("✓ Invoice INV-001 created\n");

		// Add item to invoice and change status
		await invoice1.BeginGroupAsync(new Dictionary<string, object> {
			{ "description", "Added SSL certificate" },
			{ "editor", "billing@example.com" }
		});
		var inv1 = await invoice1.GetDocumentAsync();
		inv1!.Items!.Add(new LineItem { Description = "SSL Certificate", Quantity = 1, UnitPrice = 75m, Amount = 75m });
		inv1.Subtotal = 1695m;
		inv1.Tax = 135.60m;
		inv1.Total = 1830.60m;
		await invoice1.ApplyChangesAsync(inv1);
		await invoice1.CommitGroupAsync();
		Console.WriteLine("✓ Added SSL certificate to INV-001\n");

		// Send invoice
		await invoice1.BeginGroupAsync(new Dictionary<string, object> {
			{ "description", "Invoice sent to customer" },
			{ "editor", "billing@example.com" }
		});
		inv1 = await invoice1.GetDocumentAsync();
		inv1!.Status = "sent";
		inv1.Metadata!["sentDate"] = DateTime.UtcNow.ToString("O");
		await invoice1.ApplyChangesAsync(inv1);
		await invoice1.CommitGroupAsync();
		Console.WriteLine("✓ Invoice INV-001 sent\n");

		// Create and modify Invoice 2
		var invoice2 = new Changelog<Invoice>(invoiceStorage, "invoice-inv-002");
		Console.WriteLine("Creating Invoice INV-002...");
		await invoice2.SetDocumentAsync(new Invoice {
			InvoiceNumber = "INV-002",
			CustomerId = "user-profile-jane",
			IssueDate = DateTime.UtcNow,
			DueDate = DateTime.UtcNow.AddDays(15),
			Items = new List<LineItem> {
				new LineItem { Description = "Logo Design", Quantity = 1, UnitPrice = 500m, Amount = 500m },
				new LineItem { Description = "Business Cards", Quantity = 500, UnitPrice = 0.50m, Amount = 250m }
			},
			Subtotal = 750m,
			Tax = 60m,
			Total = 810m,
			Status = "draft",
			Metadata = new Dictionary<string, object> {
				{ "project", "Branding Package" },
				{ "paymentTerms", "Net 15" }
			}
		});
		Console.WriteLine("✓ Invoice INV-002 created\n");

		// Update quantities
		await invoice2.BeginGroupAsync(new Dictionary<string, object> {
			{ "description", "Increased business card quantity" },
			{ "editor", "billing@example.com" }
		});
		var inv2 = await invoice2.GetDocumentAsync();
		inv2!.Items![1].Quantity = 1000;
		inv2.Items[1].Amount = 500m;
		inv2.Subtotal = 1000m;
		inv2.Tax = 80m;
		inv2.Total = 1080m;
		await invoice2.ApplyChangesAsync(inv2);
		await invoice2.CommitGroupAsync();
		Console.WriteLine("✓ Updated business card quantity in INV-002\n");

		Console.WriteLine("========================================");
		Console.WriteLine("Database Summary");
		Console.WriteLine("========================================\n");

		// Query database to show all documents
		using (var connection = new SqliteConnection(connectionString)) {
			await connection.OpenAsync();

			Console.WriteLine("Documents by Type:");
			var statesCmd = connection.CreateCommand();
			statesCmd.CommandText = "SELECT DocumentId FROM States ORDER BY DocumentId";
			using (var reader = await statesCmd.ExecuteReaderAsync()) {
				Console.WriteLine("\nUser Profiles:");
				var profiles = new List<string>();
				var invoices = new List<string>();
				while (await reader.ReadAsync()) {
					var docId = reader.GetString(0);
					if (docId.StartsWith("user-profile-")) {
						profiles.Add(docId);
					}
					else if (docId.StartsWith("invoice-")) {
						invoices.Add(docId);
					}
				}
				foreach (var p in profiles) {
					Console.WriteLine($"  - {p}");
				}
				Console.WriteLine("\nInvoices:");
				foreach (var i in invoices) {
					Console.WriteLine($"  - {i}");
				}
			}

			Console.WriteLine("\n\nChange Groups by Document:");
			var groupsCmd = connection.CreateCommand();
			groupsCmd.CommandText = "SELECT DocumentId, COUNT(*) as GroupCount FROM Groups GROUP BY DocumentId ORDER BY DocumentId";
			using (var reader = await groupsCmd.ExecuteReaderAsync()) {
				while (await reader.ReadAsync()) {
					Console.WriteLine($"  {reader.GetString(0)}: {reader.GetInt32(1)} groups");
				}
			}

			Console.WriteLine("\n\nTotal Changes by Document:");
			var changesCmd = connection.CreateCommand();
			changesCmd.CommandText = "SELECT DocumentId, COUNT(*) as ChangeCount FROM Changes GROUP BY DocumentId ORDER BY DocumentId";
			using (var reader = await changesCmd.ExecuteReaderAsync()) {
				while (await reader.ReadAsync()) {
					Console.WriteLine($"  {reader.GetString(0)}: {reader.GetInt32(1)} changes");
				}
			}

			Console.WriteLine("\n\nAll Groups with Details:");
			var allGroupsCmd = connection.CreateCommand();
			allGroupsCmd.CommandText = "SELECT DocumentId, Id, Timestamp, ChangeCount, Metadata FROM Groups ORDER BY DocumentId, Timestamp";
			using (var reader = await allGroupsCmd.ExecuteReaderAsync()) {
				while (await reader.ReadAsync()) {
					var docId = reader.GetString(0);
					var groupId = reader.GetString(1).Substring(0, 8);
					var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(reader.GetInt64(2));
					var changeCount = reader.GetInt32(3);
					var metadata = reader.IsDBNull(4) ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(reader.GetString(4));
					var description = metadata?.ContainsKey("description") == true ? metadata["description"] : "N/A";
					Console.WriteLine($"  [{docId}] {groupId}... - {description} ({changeCount} changes) @ {timestamp:HH:mm:ss}");
				}
			}
		}

		Console.WriteLine($"\n✓ Demo complete! Database saved to: {Path.GetFullPath(dbPath)}");
		Console.WriteLine("  The database contains:");
		Console.WriteLine("    - 2 user profiles (john, jane)");
		Console.WriteLine("    - 2 invoices (INV-001, INV-002)");
		Console.WriteLine("    - All stored in the same SQLite database with separate documentIds");
	}
}
