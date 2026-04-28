import { CliApp } from "./cli/app";

const main = async (): Promise<void> => {
  const app = new CliApp();
  const exitCode = await app.run(Bun.argv.slice(2));
  process.exitCode = exitCode;
};

await main();
