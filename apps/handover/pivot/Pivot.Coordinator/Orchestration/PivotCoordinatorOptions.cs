namespace Pivot.Orchestration;


public class PivotCoordinatorOptions
{
	public int InitialPort { get; set; } = 5001;
	public int HealthCheckMaxAttempts { get; set; } = 30;
	public int HealthCheckIntervalMs { get; set; } = 500;
	public int ShutdownDrainTimeMs { get; set; } = 10000;
	public string? ServerProjectPath { get; set; }
	public string? ServerExecutablePath { get; set; }
}
