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
