#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const os = require("os");

const ARCH_MAP = { "x64": "x64", "arm64": "arm64" };
const OS_MAP   = { "darwin": "darwin", "linux": "linux", "win32": "win32" };

const npmOs  = OS_MAP[os.platform()];
const npmCpu = ARCH_MAP[os.arch()];

if (!npmOs || !npmCpu) {
	console.error("forge: unsupported platform " + os.platform() + "/" + os.arch());
	process.exit(1);
}

const ext = os.platform() === "win32" ? ".exe" : "";
const pkgName = "@arcmantle/forge-" + npmOs + "-" + npmCpu;

let bin;
try {
	// Resolve the binary from the platform-specific optional dependency.
	const pkgDir = path.dirname(require.resolve(pkgName + "/package.json"));
	bin = path.join(pkgDir, "forge" + ext);
} catch {
	console.error(
		"forge: could not find platform package " + pkgName + "\n" +
		"       Make sure optional dependencies are installed."
	);
	process.exit(1);
}

const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
