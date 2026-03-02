package embedded

import (
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	forgemod "github.com/arcmantle/forge"
)

//go:embed helpers_ts/*.ts
var HelpersTSFS embed.FS

//go:embed helpers_cs/*.cs helpers_cs/*.csproj
var HelpersCSFS embed.FS

//go:embed forge-schema.json
var SchemaJSON []byte

//go:embed forge-template-schema.json
var TemplateSchemaJSON []byte

// ExtractSchema writes the embedded JSON schema to the given directory.
// Returns the path to the written schema file.
func ExtractSchema(forgeDir string) (string, error) {
	schemaPath := filepath.Join(forgeDir, "forge-schema.json")

	if err := os.MkdirAll(forgeDir, 0o755); err != nil {
		return "", fmt.Errorf("creating forge dir: %w", err)
	}

	if err := os.WriteFile(schemaPath, SchemaJSON, 0o644); err != nil {
		return "", fmt.Errorf("writing schema: %w", err)
	}

	return schemaPath, nil
}

// ExtractTemplateSchema writes the embedded per-command template schema to the
// given .forge directory. Returns the path to the written schema file.
func ExtractTemplateSchema(forgeDir string) (string, error) {
	schemaPath := filepath.Join(forgeDir, "template-schema.json")

	if err := os.MkdirAll(forgeDir, 0o755); err != nil {
		return "", fmt.Errorf("creating forge dir: %w", err)
	}

	if err := os.WriteFile(schemaPath, TemplateSchemaJSON, 0o644); err != nil {
		return "", fmt.Errorf("writing template schema: %w", err)
	}

	return schemaPath, nil
}

// ExtractHelpers writes the embedded helpers source to the target directory.
// Returns the path to the extracted helpers directory.
func ExtractHelpers(cacheDir string) (string, error) {
	helpersDir := filepath.Join(cacheDir, "helpers")

	if err := os.MkdirAll(helpersDir, 0o755); err != nil {
		return "", fmt.Errorf("creating helpers dir: %w", err)
	}

	err := fs.WalkDir(forgemod.GoHelpersFS, "helpers", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(cacheDir, path)

		if d.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}

		content, err := forgemod.GoHelpersFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading embedded %s: %w", path, err)
		}

		return os.WriteFile(targetPath, content, 0o644)
	})

	if err != nil {
		return "", fmt.Errorf("extracting helpers: %w", err)
	}

	// Write a go.mod for the extracted helpers module.
	goMod := "module github.com/arcmantle/forge\n\ngo 1.22\n"
	goModPath := filepath.Join(cacheDir, "go.mod")

	if err := os.WriteFile(goModPath, []byte(goMod), 0o644); err != nil {
		return "", fmt.Errorf("writing helpers go.mod: %w", err)
	}

	return cacheDir, nil
}

// ExtractHelpersTS writes the embedded TypeScript helpers to the target directory.
func ExtractHelpersTS(cacheDir string) (string, error) {
	tsDir := filepath.Join(cacheDir, "helpers_ts")

	if err := os.MkdirAll(tsDir, 0o755); err != nil {
		return "", fmt.Errorf("creating ts helpers dir: %w", err)
	}

	err := fs.WalkDir(HelpersTSFS, "helpers_ts", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(cacheDir, path)

		if d.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}

		content, err := HelpersTSFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading embedded %s: %w", path, err)
		}

		return os.WriteFile(targetPath, content, 0o644)
	})

	if err != nil {
		return "", fmt.Errorf("extracting ts helpers: %w", err)
	}

	return tsDir, nil
}

// ExtractHelpersCS writes the embedded C# helpers to the target directory.
func ExtractHelpersCS(cacheDir string) (string, error) {
	csDir := filepath.Join(cacheDir, "helpers_cs")

	if err := os.MkdirAll(csDir, 0o755); err != nil {
		return "", fmt.Errorf("creating cs helpers dir: %w", err)
	}

	err := fs.WalkDir(HelpersCSFS, "helpers_cs", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		targetPath := filepath.Join(cacheDir, path)

		if d.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}

		// Only embed .cs and .csproj files — skip bin/, obj/, .gitignore.
		ext := filepath.Ext(path)
		if ext != ".cs" && ext != ".csproj" {
			return nil
		}

		content, err := HelpersCSFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading embedded %s: %w", path, err)
		}

		return os.WriteFile(targetPath, content, 0o644)
	})

	if err != nil {
		return "", fmt.Errorf("extracting cs helpers: %w", err)
	}

	return csDir, nil
}

// EnsurePackageJSON writes a package.json in the .forge/ directory
// that maps #helpers to the extracted TS helpers via Node subpath imports.
func EnsurePackageJSON(forgeDir string, cacheDir string) error {
	pkgPath := filepath.Join(forgeDir, "package.json")
	pkg := `{
	"type": "module",
	"imports": {
		"#helpers": "./cache/_helpers/helpers_ts/helpers.ts"
	},
	"devDependencies": {
		"@types/node": "*"
	}
}
`
	return os.WriteFile(pkgPath, []byte(pkg), 0o644)
}

// EnsureTSConfig writes a tsconfig.json in the .forge/ directory
// for TypeScript intellisense in forge scripts.
func EnsureTSConfig(forgeDir string) error {
	tsconfigPath := filepath.Join(forgeDir, "tsconfig.json")

	// Don't overwrite if user has customized it.
	if _, err := os.Stat(tsconfigPath); err == nil {
		return nil
	}

	tsconfig := `{
	"compilerOptions": {
		"target": "ESNext",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"strict": true,
		"noEmit": true,
		"skipLibCheck": true,
		"rootDir": ".",
		"types": ["node"]
	},
	"include": ["scripts", "cache/_helpers"]
}
`
	return os.WriteFile(tsconfigPath, []byte(tsconfig), 0o644)
}

// EnsureCSProj writes a ForgeScripts.csproj in the .forge/ directory
// for C# intellisense in forge scripts. It references the extracted helpers
// project and includes all .cs files in the scripts/ directory.
func EnsureCSProj(forgeDir string) error {
	csprojPath := filepath.Join(forgeDir, "ForgeScripts.csproj")

	// Don't overwrite if user has customized it.
	if _, err := os.Stat(csprojPath); err == nil {
		return nil
	}

	csproj := `<Project Sdk="Microsoft.NET.Sdk">
	<PropertyGroup>
		<OutputType>Exe</OutputType>
		<TargetFramework>net9.0</TargetFramework>
		<ImplicitUsings>disable</ImplicitUsings>
		<Nullable>enable</Nullable>
		<EnableDefaultCompileItems>false</EnableDefaultCompileItems>
		<NoWarn>CS8321</NoWarn>
	</PropertyGroup>
	<ItemGroup>
		<Compile Include="scripts\**\*.cs" />
	</ItemGroup>
	<ItemGroup>
		<ProjectReference Include="cache\_helpers\helpers_cs\ForgeHelpers.csproj" />
	</ItemGroup>
</Project>
`
	return os.WriteFile(csprojPath, []byte(csproj), 0o644)
}

// EnsureSLNX writes a ForgeScripts.slnx in the .forge/ directory
// so C# Dev Kit can discover the project and provide intellisense.
func EnsureSLNX(forgeDir string) error {
	slnxPath := filepath.Join(forgeDir, "ForgeScripts.slnx")

	// Don't overwrite if user has customized it.
	if _, err := os.Stat(slnxPath); err == nil {
		return nil
	}

	slnx := `<Solution>
	<Project Path="ForgeScripts.csproj" />
</Solution>
`
	return os.WriteFile(slnxPath, []byte(slnx), 0o644)
}
