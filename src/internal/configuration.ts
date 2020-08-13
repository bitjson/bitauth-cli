export enum EnvironmentVariables {
  dataDirectory = 'BITAUTH_DATA_DIR',
  logLevel = 'BITAUTH_LOG_LEVEL',
}

/* eslint-disable @typescript-eslint/naming-convention */
export const environment = {
  BITAUTH_DATA_DIR: process.env.BITAUTH_DATA_DIR ?? '~/.bitauth',
  BITAUTH_LOG_LEVEL: process.env.BITAUTH_LOG_LEVEL ?? 'info',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const logFileName = 'logs--sensitive-do-not-share.ndjson';

export enum ReservedAlias {
  config = 'config',
  create = 'create',
  group = 'group',
  groups = 'groups',
  help = 'help',
  id = 'id',
  list = 'list',
  profile = 'profile',
  new = 'new',
  tx = 'tx',
  verify = 'verify',
  wallet = 'wallet',
}

export const reservedAliasList = [
  ReservedAlias.config,
  ReservedAlias.create,
  ReservedAlias.group,
  ReservedAlias.groups,
  ReservedAlias.help,
  ReservedAlias.id,
  ReservedAlias.list,
  ReservedAlias.profile,
  ReservedAlias.new,
  ReservedAlias.tx,
  ReservedAlias.verify,
  ReservedAlias.wallet,
];

export enum DataDirectory {
  templates = 'templates',
  wallets = 'wallets',
  readme = 'readme.md',
  walletSecret = 'wallet-secret.json',
  walletCache = 'cache.json',
}

export enum DefaultTemplates {
  p2pkh = 'p2pkh',
  twoOfThree = '2-of-3',
  twoOfTwoRecoverable = '2-of-2-recoverable',
}
