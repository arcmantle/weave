using Pivot.Extensions;


var builder = WebApplication.CreateSlimBuilder(args);

builder.AddPivotProxy(options => {
	options.CoordinatorUrl = "http://localhost:5100";
});

var app = builder.Build();

app.MapPivotProxy();

app.Run();
