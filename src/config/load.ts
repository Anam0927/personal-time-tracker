import { cosmiconfig } from "cosmiconfig";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { xdgConfig } from "xdg-basedir";
import { configSchema, type Config } from "./schemas";

const MODULE_NAME = "time-tracker";

function parseConfig(config: Record<string, unknown>): Config {
  return configSchema.parse(config);
}

export async function loadConfig(argsConfigPath?: string): Promise<Config> {
  if (argsConfigPath) {
    const argsConfigFullPath = path.resolve(argsConfigPath);

    const argsConfig = await readFile(argsConfigFullPath, {
      encoding: "utf-8",
    }).then((content) => JSON.parse(content));

    if (argsConfig) {
      return parseConfig(argsConfig);
    }
  }

  if (!xdgConfig) {
    throw new Error(
      "XDG_CONFIG_HOME is not set. Cannot determine config directory.",
    );
  }

  const globalConfigDir = path.join(xdgConfig, MODULE_NAME);
  const globalConfigPath = path.join(globalConfigDir, "config.json");

  const explorer = cosmiconfig("time-tracker", {
    searchPlaces: [
      "package.json",
      `.${MODULE_NAME}rc.json`,
      `${MODULE_NAME}.config.json`,
    ],
    stopDir: globalConfigDir,
  });

  const result = await explorer.search();

  if (result && result.config && !result.isEmpty) {
    return parseConfig(result.config);
  }

  const globalConfig = await readFile(globalConfigPath, {
    encoding: "utf-8",
  })
    .then((content) => JSON.parse(content) as Record<string, unknown>)
    .catch((error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT" // No such file or directory
      ) {
        return undefined;
      }

      throw error;
    });

  if (globalConfig) {
    return parseConfig(globalConfig);
  }

  return parseConfig({});
}
