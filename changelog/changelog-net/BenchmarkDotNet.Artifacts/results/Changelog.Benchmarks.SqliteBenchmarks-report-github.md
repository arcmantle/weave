```

BenchmarkDotNet v0.14.0, Windows 11 (10.0.26100.7462)
AMD Ryzen 7 3700X, 1 CPU, 16 logical and 8 physical cores
.NET SDK 10.0.101
  [Host]     : .NET 10.0.1 (10.0.125.57005), X64 RyuJIT AVX2
  DefaultJob : .NET 10.0.1 (10.0.125.57005), X64 RyuJIT AVX2


```
| Method                   | ChangeCount | GroupSize | StorageMode  | Mean     | Error     | StdDev    | Gen0   | Allocated |
|------------------------- |------------ |---------- |------------- |---------:|----------:|----------:|-------:|----------:|
| **ConcurrentReadWriteAsync** | **100000**      | **1000**      | **sqlite**       | **2.374 ms** | **0.0458 ms** | **0.0450 ms** | **0.2170** |    **2.9 KB** |
| **ConcurrentReadWriteAsync** | **100000**      | **1000**      | **sqlite+cache** | **3.460 ms** | **0.0337 ms** | **0.0299 ms** | **0.2170** |   **1.81 KB** |
