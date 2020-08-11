/**
 * This file does the minimum initialization necessary before logging can begin.
 * Because it would require a cyclic dependency on logging infrastructure, this
 * file can only log to the console.
 *
 * All other initialization should be done in `initialize-data-directory.ts`.
 */
import { homedir } from 'os';
import { join, resolve } from 'path';

import { ensureDir } from 'fs-extra';

import { DataDirectory, environment } from '../configuration';

const extendTildeAndResolvePath = (path: string) =>
  path.startsWith('~')
    ? resolve(join(homedir(), path.slice(1)))
    : resolve(path);

const ensureBitauthDataDirectory = async () => {
  const dataDir = extendTildeAndResolvePath(environment.BITAUTH_DATA_DIR);
  return Promise.all([
    ensureDir(join(dataDir, DataDirectory.templates)),
    ensureDir(join(dataDir, DataDirectory.wallets)),
  ])
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(
        'Cannot recover from non-existent or malformed Bitauth data directory.',
        dataDir,
        error
      );
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    })
    .then(() => dataDir);
};

/**
 * Promise which returns the Bitauth data directory path once it's been either
 * instantiated or verified. This functions as a sort of "onReady", and ensures
 * we only verify the data directory once per run.
 */
export const bitauthDataDirectory = ensureBitauthDataDirectory();
