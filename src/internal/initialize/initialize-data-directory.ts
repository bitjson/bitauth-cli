/**
 * This file initializes the logger and performs any necessary maintenance on
 * the Bitauth data directory.
 */
import { join } from 'path';

import { readFile, writeFile } from 'fs-extra';
import * as pino from 'pino';

import { DataDirectory, logFileName } from '../configuration';
import { defaultReadmeMd } from '../defaults';
import { colors } from '../formatting';

import { bitauthDataDirectory } from './ensure-data-directory';

const getLoggerInstance = async () => {
  const dataDir = await bitauthDataDirectory;
  const logFilePath = join(dataDir, logFileName);
  const logger = pino({ level: 'trace' }, pino.destination(logFilePath));
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debug: (msg: string, ...args: any[]) => logger.debug(msg, ...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fatal: (msg: string, ...args: any[]) => {
      logger.fatal(msg, ...args);
      // eslint-disable-next-line no-console
      console.error(colors.red('✖'), colors.red.bold(msg), ...args);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (msg: string, ...args: any[]) => logger.info(msg, ...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trace: (msg: string, ...args: any[]) => logger.trace(msg, ...args),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn: (msg: string, ...args: any[]) => {
      logger.warn(msg, ...args);
      // eslint-disable-next-line no-console
      console.error(colors.yellow('⚠'), colors.yellow.bold(msg), ...args);
    },
  };
};

/**
 * A promise which returns the logger instance initialized for this run of the
 * CLI.
 */
export const logger = getLoggerInstance().then((log) => {
  const firstArg = 2;
  const command = process.argv.slice(firstArg).join(' ');
  log.debug(`command: ${command}`);
  return log;
});

/**
 * Data directory migrations and validations. These run once every time the CLI
 * is initialized.
 */
const validationsAndMigrations = async () => {
  const dataDir = await bitauthDataDirectory;
  const readmePath = join(dataDir, DataDirectory.readme);
  const readmeContents = await readFile(readmePath, 'utf8').catch(
    () => undefined
  );
  if (readmeContents !== defaultReadmeMd) {
    (await logger).info(`Readme.md does not match, overwriting: ${readmePath}`);
    await writeFile(readmePath, defaultReadmeMd);
  }
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
validationsAndMigrations();
