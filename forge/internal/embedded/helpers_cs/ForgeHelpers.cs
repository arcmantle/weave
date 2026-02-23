using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Forge.Helpers;

// --- Colors ---

public static class Colors
{
	public const string Reset = "\x1b[0m";
	public const string Red = "\x1b[31m";
	public const string Green = "\x1b[32m";
	public const string Yellow = "\x1b[33m";
	public const string Blue = "\x1b[34m";
	public const string Magenta = "\x1b[35m";
	public const string Cyan = "\x1b[36m";
	public const string Gray = "\x1b[90m";
	public const string BrightRed = "\x1b[91m";

	public static readonly string[] Cycle =
	[
		Cyan,
		Yellow,
		Magenta,
		Green,
		Blue,
		BrightRed,
		"\x1b[96m", // bright cyan
		"\x1b[93m", // bright yellow
		"\x1b[95m", // bright magenta
		"\x1b[92m", // bright green
	];
}

// --- Logging ---

public static class Log
{
	public static void Info(string message, params object[] args) =>
		Console.WriteLine($"\x1b[36minfo:\x1b[0m {string.Format(message, args)}");

	public static void Warn(string message, params object[] args) =>
		Console.WriteLine($"\x1b[33mwarn:\x1b[0m {string.Format(message, args)}");

	public static void Error(string message, params object[] args) =>
		Console.WriteLine($"\x1b[31merror:\x1b[0m {string.Format(message, args)}");

	public static void Success(string message, params object[] args) =>
		Console.WriteLine($"\x1b[32m✓\x1b[0m {string.Format(message, args)}");
}

// --- Exec ---

public class RunOpts
{
	/// <summary>Working directory. If null, uses the current directory.</summary>
	public string? Dir { get; init; }
	/// <summary>Prefix label for output lines (e.g. workspace name).</summary>
	public string? Tag { get; init; }
	/// <summary>ANSI color code for the tag.</summary>
	public string? Color { get; init; }
	/// <summary>Additional environment variables.</summary>
	public Dictionary<string, string>? Env { get; init; }
	/// <summary>Suppress all output.</summary>
	public bool Silent { get; init; }
}

public static class Exec
{
	/// <summary>Run a command with streaming prefixed output.</summary>
	public static Task Run(string name, string[] args, RunOpts? opts = null)
	{
		opts ??= new RunOpts();

		var psi = new ProcessStartInfo
		{
			FileName = name,
			WorkingDirectory = opts.Dir ?? Directory.GetCurrentDirectory(),
			UseShellExecute = false,
			RedirectStandardOutput = opts.Tag is not null && !opts.Silent,
			RedirectStandardError = opts.Tag is not null && !opts.Silent,
		};

		foreach (var arg in args)
			psi.ArgumentList.Add(arg);

		if (opts.Env is not null)
		{
			foreach (var (key, value) in opts.Env)
				psi.Environment[key] = value;
		}

		var process = Process.Start(psi)
			?? throw new InvalidOperationException($"Failed to start {name}");

		if (opts.Silent)
			return process.WaitForExitAsync();

		if (opts.Tag is not null)
		{
			var tag = FormatTag(opts.Tag, opts.Color);

			process.OutputDataReceived += (_, e) =>
			{
				if (e.Data is not null)
					Console.WriteLine($"{tag} {e.Data}");
			};

			process.ErrorDataReceived += (_, e) =>
			{
				if (e.Data is not null)
					Console.Error.WriteLine($"{tag} {e.Data}");
			};

			process.BeginOutputReadLine();
			process.BeginErrorReadLine();
		}

		return WaitAndThrow(process, name);
	}

	/// <summary>Run a command and return its combined output as a string.</summary>
	public static string RunSimple(string name, string[] args, string? dir = null)
	{
		var psi = new ProcessStartInfo
		{
			FileName = name,
			WorkingDirectory = dir ?? Directory.GetCurrentDirectory(),
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
		};

		foreach (var arg in args)
			psi.ArgumentList.Add(arg);

		var process = Process.Start(psi)
			?? throw new InvalidOperationException($"Failed to start {name}");

		var output = process.StandardOutput.ReadToEnd()
			+ process.StandardError.ReadToEnd();

		process.WaitForExit();

		return output.Trim();
	}

	private static async Task WaitAndThrow(Process process, string name)
	{
		await process.WaitForExitAsync();

		if (process.ExitCode != 0)
			throw new InvalidOperationException($"{name} exited with code {process.ExitCode}");
	}

	private static string FormatTag(string tag, string? color)
	{
		if (color is null)
			return $"[{tag}]";

		return $"{color}[{tag}]{Colors.Reset}";
	}
}

// --- Filesystem ---

public static class Fs
{
	/// <summary>Check if a file or directory exists.</summary>
	public static bool FileExists(string path) =>
		File.Exists(path) || Directory.Exists(path);

	/// <summary>Find child directories of root that contain a specific file.</summary>
	public static string[] FindDirsContaining(string root, string filename) =>
		Directory.GetDirectories(root)
			.Where(d => File.Exists(Path.Combine(d, filename)))
			.ToArray();

	/// <summary>Find directories matching a search pattern under root.</summary>
	public static string[] FindDirs(string root, string pattern) =>
		Directory.GetDirectories(root, pattern);

	/// <summary>Find files matching a search pattern under root.</summary>
	public static string[] FindFiles(string root, string pattern) =>
		Directory.GetFiles(root, pattern);
}

// --- Command Builder ---

/// <summary>Holds a parsed string argument value.</summary>
public class StringValue
{
	public string Value { get; set; } = "";
}

/// <summary>Holds a parsed boolean flag value.</summary>
public class BoolValue
{
	public bool Value { get; set; }
}

/// <summary>
/// Builder for defining and parsing command arguments.
/// Supports positional args, string options, and boolean flags.
/// <code>
/// var cmd = Cmd.Create("greet", "Greet someone");
/// var name = cmd.Arg("name", "Name to greet");
/// var shout = cmd.Flag("shout", "Uppercase the greeting");
/// cmd.Parse();
/// </code>
/// </summary>
public class Cmd
{
	private readonly string _name;
	private readonly string _description;
	private readonly List<ArgDef> _defs = [];

	private Cmd(string name, string description)
	{
		_name = name;
		_description = description;
	}

	/// <summary>Creates a new command argument builder.</summary>
	public static Cmd Create(string name, string description) => new(name, description);

	/// <summary>Define a required positional argument.</summary>
	public StringValue Arg(string name, string description)
	{
		var v = new StringValue();
		_defs.Add(new ArgDef
		{
			Name = name,
			Description = description,
			Type = "string",
			Positional = true,
			Required = true,
			Value = v,
		});

		return v;
	}

	/// <summary>Define a named string option (--name value).</summary>
	public StringValue Option(string name, string description, string? defaultVal = null)
	{
		var v = new StringValue { Value = defaultVal ?? "" };
		_defs.Add(new ArgDef
		{
			Name = name,
			Description = description,
			Type = "string",
			DefaultVal = defaultVal ?? "",
			Value = v,
		});

		return v;
	}

	/// <summary>Define a boolean flag (--name). Presence sets it to true.</summary>
	public BoolValue Flag(string name, string description)
	{
		var v = new BoolValue();
		_defs.Add(new ArgDef
		{
			Name = name,
			Description = description,
			Type = "bool",
			Value = v,
		});

		return v;
	}

	/// <summary>
	/// Parse command-line arguments.
	/// If --forge-meta is present, prints JSON metadata and exits.
	/// If --help or -h is present, prints a help screen and exits.
	/// </summary>
	public void Parse()
	{
		var rawArgs = Environment.GetCommandLineArgs().Skip(1).ToArray();

		if (rawArgs.Contains("--forge-meta"))
		{
			PrintMeta();
			Environment.Exit(0);
		}

		if (rawArgs.Contains("--help") || rawArgs.Contains("-h"))
		{
			PrintHelp();
			Environment.Exit(0);
		}

		var positionals = _defs.Where(d => d.Positional).ToList();
		var posIdx = 0;

		for (var i = 0; i < rawArgs.Length; i++)
		{
			var arg = rawArgs[i];

			if (arg.StartsWith("--"))
			{
				var name = arg[2..];
				var def = _defs.FirstOrDefault(d => !d.Positional && d.Name == name);
				if (def is null)
				{
					Log.Error($"unknown flag: --{name}");
					PrintHelp();
					Environment.Exit(1);
				}

				if (def.Type == "bool")
				{
					((BoolValue)def.Value).Value = true;
				}
				else
				{
					if (i + 1 >= rawArgs.Length)
					{
						Log.Error($"flag --{name} requires a value");
						Environment.Exit(1);
					}
					i++;
					((StringValue)def.Value).Value = rawArgs[i];
				}
			}
			else
			{
				if (posIdx >= positionals.Count)
				{
					Log.Error($"unexpected argument: {arg}");
					PrintHelp();
					Environment.Exit(1);
				}
				((StringValue)positionals[posIdx].Value).Value = arg;
				posIdx++;
			}
		}

		foreach (var p in positionals)
		{
			if (p.Required && ((StringValue)p.Value).Value == "")
			{
				Log.Error($"missing required argument: <{p.Name}>");
				PrintHelp();
				Environment.Exit(1);
			}
		}
	}

	private void PrintHelp()
	{
		var positionals = _defs.Where(d => d.Positional).ToList();
		var flags = _defs.Where(d => !d.Positional).ToList();

		var usage = $"forge {_name}";
		foreach (var p in positionals) usage += $" <{p.Name}>";
		if (flags.Count > 0) usage += " [flags]";

		Console.WriteLine($"{_name} — {_description}\n");
		Console.WriteLine($"Usage:\n  {usage}");

		if (positionals.Count > 0)
		{
			Console.WriteLine("\nArgs:");
			var maxLen = positionals.Max(p => p.Name.Length);
			foreach (var p in positionals)
				Console.WriteLine($"  {p.Name.PadRight(maxLen)}    {p.Description}");
		}

		if (flags.Count > 0)
		{
			Console.WriteLine("\nFlags:");
			var flagNames = flags.Select(f => f.Type == "string" ? $"--{f.Name} <value>" : $"--{f.Name}").ToList();
			var maxLen = flagNames.Max(n => n.Length);
			for (var i = 0; i < flags.Count; i++)
			{
				var desc = flags[i].Description;
				if (!string.IsNullOrEmpty(flags[i].DefaultVal)) desc += $" (default: {flags[i].DefaultVal})";
				Console.WriteLine($"  {flagNames[i].PadRight(maxLen)}    {desc}");
			}
		}
	}

	private void PrintMeta()
	{
		var meta = new
		{
			name = _name,
			description = _description,
			args = _defs.Select(d =>
			{
				var obj = new Dictionary<string, object>
				{
					["name"] = d.Name,
					["type"] = d.Type,
					["description"] = d.Description,
				};
				if (d.Positional) obj["positional"] = true;
				if (d.Required) obj["required"] = true;
				if (!string.IsNullOrEmpty(d.DefaultVal)) obj["default"] = d.DefaultVal;

				return obj;
			}).ToArray(),
		};

		var json = System.Text.Json.JsonSerializer.Serialize(meta,
			new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
		Console.WriteLine(json);
	}

	private class ArgDef
	{
		public required string Name { get; init; }
		public required string Description { get; init; }
		public required string Type { get; init; }
		public bool Positional { get; init; }
		public bool Required { get; init; }
		public string DefaultVal { get; init; } = "";
		public required object Value { get; init; }
	}
}
