#!/usr/bin/env node
import { runCli } from '../run-cli.js';

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
