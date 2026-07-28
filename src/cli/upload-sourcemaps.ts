#!/usr/bin/env node
// src/cli/upload-sourcemaps.ts
import * as fs from "fs";
import * as path from "path";

interface CliArgs {
  version: string;
  platform: string;
  dir: string;
  apiUrl: string;
  apiKey: string;
  clean: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let clean = false;

  for (const arg of argv) {
    if (arg === "--clean") {
      clean = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }

  const required = ["version", "platform", "dir", "api-url", "api-key"];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required argument: --${key}`);
    }
  }

  return {
    version: args["version"],
    platform: args["platform"],
    dir: args["dir"],
    apiUrl: args["api-url"],
    apiKey: args["api-key"],
    clean,
  };
}

export function findSourceMaps(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".map")) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

async function uploadFile(
  filePath: string,
  config: CliArgs,
): Promise<void> {
  const content = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  const formData = new FormData();
  formData.append("file", new Blob([content]), filename);
  formData.append("platform", config.platform);
  formData.append("version", config.version);

  const response = await fetch(`${config.apiUrl}/client-errors/sourcemaps`, {
    method: "POST",
    headers: { "x-sourcemap-api-key": config.apiKey },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${filename}: ${response.status} ${response.statusText}`);
  }
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const maps = findSourceMaps(config.dir);

  if (maps.length === 0) {
    console.log(`No .map files found in ${config.dir}`);
    return;
  }

  console.log(`Found ${maps.length} source map(s) for ${config.platform}@${config.version}`);

  let uploaded = 0;
  for (const mapFile of maps) {
    await uploadFile(mapFile, config);
    uploaded++;
    console.log(`  [${uploaded}/${maps.length}] ${path.basename(mapFile)}`);
  }

  if (config.clean) {
    for (const mapFile of maps) {
      fs.unlinkSync(mapFile);
    }
    console.log(`Cleaned ${maps.length} .map file(s) from ${config.dir}`);
  }

  console.log(`Uploaded ${uploaded}/${maps.length} source maps for ${config.platform}@${config.version}`);
}

// Only run main when executed directly, not when imported for tests
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
