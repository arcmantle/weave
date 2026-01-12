using System.Threading.Channels;
using Coordinator.Models;

namespace Coordinator.Services;


public class BackendRegistry {
	private List<BackendInfo> _backends = new();
	private readonly Channel<List<BackendInfo>> _changeChannel =
		Channel.CreateUnbounded<List<BackendInfo>>();
	private readonly SemaphoreSlim _lock = new(1, 1);

	public async Task<List<BackendInfo>> GetAllAsync() {
		await _lock.WaitAsync();
		try {
			return _backends.ToList();
		}
		finally {
			_lock.Release();
		}
	}

	public async Task UpdateAsync(List<BackendInfo> backends) {
		await _lock.WaitAsync();
		try {
			_backends = backends.ToList();
			// Notify all watchers of the change
			await _changeChannel.Writer.WriteAsync(backends);
		}
		finally {
			_lock.Release();
		}
	}

	public async IAsyncEnumerable<List<BackendInfo>> WatchChangesAsync(
		[System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken
	) {
		// Send current state immediately
		yield return await GetAllAsync();

		// Then stream changes as they happen
		await foreach (var backends in _changeChannel.Reader.ReadAllAsync(cancellationToken)) {
			yield return backends;
		}
	}
}
