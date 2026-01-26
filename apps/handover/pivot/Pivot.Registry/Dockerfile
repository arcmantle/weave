FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["Pivot.Registry/Pivot.Registry.csproj", "Pivot.Registry/"]
COPY ["Pivot.Core/Pivot.Core.csproj", "Pivot.Core/"]
RUN dotnet restore "Pivot.Registry/Pivot.Registry.csproj"
COPY . .
WORKDIR "/src/Pivot.Registry"
RUN dotnet build "Pivot.Registry.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Pivot.Registry.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Pivot.Registry.dll"]
