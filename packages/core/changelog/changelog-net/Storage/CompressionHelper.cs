using System;
using System.IO;
using System.IO.Compression;
using System.Text;

namespace Changelog.Storage;

/// <summary>
/// Provides gzip compression/decompression utilities for reducing storage size.
/// </summary>
public static class CompressionHelper {
	/// <summary>
	/// Compress a string using gzip compression.
	/// </summary>
	/// <param name="text">The text to compress.</param>
	/// <returns>Compressed bytes.</returns>
	public static byte[] Compress(string text) {
		if (string.IsNullOrEmpty(text)) {
			return Array.Empty<byte>();
		}

		var bytes = Encoding.UTF8.GetBytes(text);
		return CompressBytes(bytes);
	}

	/// <summary>
	/// Decompress gzip-compressed bytes back to a string.
	/// </summary>
	/// <param name="compressed">The compressed bytes.</param>
	/// <returns>Decompressed string.</returns>
	public static string Decompress(byte[] compressed) {
		if (compressed == null || compressed.Length == 0) {
			return string.Empty;
		}

		var bytes = DecompressBytes(compressed);
		return Encoding.UTF8.GetString(bytes);
	}

	/// <summary>
	/// Compress a byte array using gzip compression.
	/// </summary>
	/// <param name="data">The data to compress.</param>
	/// <returns>Compressed bytes.</returns>
	public static byte[] CompressBytes(byte[] data) {
		if (data == null || data.Length == 0) {
			return Array.Empty<byte>();
		}

		using var outputStream = new MemoryStream();
		using (var gzipStream = new GZipStream(outputStream, CompressionLevel.Optimal)) {
			gzipStream.Write(data, 0, data.Length);
		}
		return outputStream.ToArray();
	}

	/// <summary>
	/// Decompress gzip-compressed bytes.
	/// </summary>
	/// <param name="compressed">The compressed data.</param>
	/// <returns>Decompressed bytes.</returns>
	public static byte[] DecompressBytes(byte[] compressed) {
		if (compressed == null || compressed.Length == 0) {
			return Array.Empty<byte>();
		}

		using var inputStream = new MemoryStream(compressed);
		using var gzipStream = new GZipStream(inputStream, CompressionMode.Decompress);
		using var outputStream = new MemoryStream();
		gzipStream.CopyTo(outputStream);
		return outputStream.ToArray();
	}

	/// <summary>
	/// Get compression ratio (0.0 to 1.0, lower is better).
	/// </summary>
	/// <param name="originalSize">Original size in bytes.</param>
	/// <param name="compressedSize">Compressed size in bytes.</param>
	/// <returns>Compression ratio (e.g., 0.3 = 70% reduction).</returns>
	public static double GetCompressionRatio(int originalSize, int compressedSize) {
		if (originalSize == 0) return 0;
		return compressedSize / (double)originalSize;
	}

	/// <summary>
	/// Calculate percentage of storage saved.
	/// </summary>
	/// <param name="originalSize">Original size in bytes.</param>
	/// <param name="compressedSize">Compressed size in bytes.</param>
	/// <returns>Percentage saved (e.g., 70.0 for 70% reduction).</returns>
	public static double GetSavingsPercentage(int originalSize, int compressedSize) {
		if (originalSize == 0) return 0;
		return ((originalSize - compressedSize) / (double)originalSize) * 100;
	}
}
