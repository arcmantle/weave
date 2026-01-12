using Pivot.Extensions;


var builder = WebApplication.CreateSlimBuilder(args);

builder.AddPivotCoordinator(options => {
	options.ServerProjectPath = "../Server/Server.csproj";
});

var app = builder.Build();

app.MapPivotCoordinator();

app.Run();
