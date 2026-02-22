#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const os = require("os");

const ARCH_MAP = { "x64": "amd64", "arm64": "arm64" };
const OS_MAP   = { "darwin": "darwin", "linux": "linux", "win32": "windows" };

const goOs   = OS_MAP[os.platform()];
const goArch = ARCH_MAP[os.arch()];

if (!goOs || !goArch) {
	console.error("forge: unsupported platform " + os.platform() + "/" + os.arch());
	process.exit(1);
}

const ext = os.platform() === "win32" ? ".exe" : "";
const bin = path.join(__dirname, "..", "dist", "forge-" + goOs + "-" + goArch + ext);

const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
