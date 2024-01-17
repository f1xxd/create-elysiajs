#!/usr/bin/env node
import child_process from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prompt } from "enquirer";
import minimist from "minimist";
import task from "tasuku";
import {
	getElysiaIndex,
	getInstallCommands,
	getPackageJson,
} from "./templates";
import { getTSConfig } from "./templates/tsconfig.json";
import { Preferences, createOrFindDir, detectPackageManager } from "./utils";
const exec = promisify(child_process.exec);

const preferences = new Preferences();

const args = minimist(process.argv.slice(2));

const packageManager = detectPackageManager();
const dir = args._.at(0);
if (!dir) throw Error("no dir");
const projectDir = path.resolve(process.cwd() + "/", dir);

createOrFindDir(projectDir).then(async () => {
	preferences.dir = dir;
	preferences.packageManager = packageManager;
	const { linter } = await prompt<{ linter: "ESLint" | "Biome" | "None" }>({
		type: "select",
		name: "linter",
		message: "Select linters/formatters:",
		choices: ["None", "ESLint", "Biome"],
	});
	preferences.linter = linter;

	if (linter === "ESLint")
		await fs.writeFile(
			projectDir + "/.eslintrc",
			JSON.stringify({ extends: "standard" }, null, 2),
		);
	await fs.writeFile(projectDir + "/package.json", getPackageJson(preferences));
	await fs.writeFile(projectDir + "/tsconfig.json", getTSConfig(preferences));
	await fs.mkdir(projectDir + "/src");
	await fs.writeFile(projectDir + "/src/index.ts", getElysiaIndex(preferences));

	const commands = getInstallCommands(preferences);

	for await (const command of commands) {
		await task(command, async () => {
			await exec(command, {
				cwd: projectDir,
			});
		});
	}
});
