import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { parseJsonFlag, parseJsonFlagOrFail } from '../../internal/flags';
import { colors } from '../../internal/formatting';
import { logger } from '../../internal/initialize';
import { getTemplates } from '../../internal/storage';

const bashEscapeSingleQuote = (bashString: string) =>
  bashString.replace(/'/gu, "'\\''");

export default class WalletNew extends Command {
  static description = `create a new wallet

Longer description here`;

  static examples = [
    `$ bitauth wallet:new # (starts interactive flow)`,
    `$ bitauth wallet:new 'Personal Wallet' --alias='personal' --template='p2pkh' --entity='owner'`,
    `$ bitauth wallet:new 'Business Wallet' --alias='business' --template='2-of-2-recoverable' --entity='signer_1' --wallet-data='{"delay_seconds":"2592000"}'`,
  ];

  static flags = {
    'address-data': flags.string({
      description: 'an array of address data in JSON format',
    }),
    alias: flags.string({ description: 'the alias of the new wallet' }),
    entity: flags.string({
      description: 'the role performed by the new wallet',
    }),
    help: flags.help({ char: 'h' }),
    template: flags.string({ description: 'the alias of the template to use' }),
    // "template-parameters": flags.string({description: 'the parameters to pass to a dynamic template'}),
    'wallet-data': flags.string({
      description: 'an object containing the wallet data in JSON format',
    }),
  };

  static args = [
    {
      description: 'wallet name',
      name: 'WALLET_NAME',
    },
  ];

  async run() {
    const log = await logger;
    const { args, flags: flag } = this.parse(WalletNew);
    const walletName = args.WALLET_NAME as string | undefined;

    const templatesPromise = getTemplates();
    const settings =
      walletName === undefined
        ? await (async () => {
            const result = await interactiveCreateWallet(templatesPromise);
            log.debug(`interactiveCreateWallet returned: %j`, result);
            const equivalentCommand = `bitauth:new '${bashEscapeSingleQuote(
              result.walletName
            )}' --alias='${result.walletAlias}' --template='${
              result.templateAlias
            }' --entity='${result.entityId}'${
              'walletData' in result && result.walletData !== undefined
                ? ` --wallet-data='${bashEscapeSingleQuote(
                    JSON.stringify(result.walletData)
                  )}'`
                : ''
            }${
              'addressData' in result && result.addressData !== undefined
                ? ` --address-data='${bashEscapeSingleQuote(
                    JSON.stringify(result.addressData)
                  )}'`
                : ''
            }`;
            log.trace(`equivalent command: ${equivalentCommand}`);
            this.log(colors.dim(equivalentCommand));
            return result;
          })()
        : await (async () => {
            const addressData = await parseJsonFlagOrFail(flag, 'address-data');
            const walletData = await parseJsonFlagOrFail(flag, 'wallet-data');
            return {
              addressData: addressData?.parsed,
              entityId: flag.entity,
              templateAlias: flag.template,
              walletAlias: flag.alias,
              walletData: walletData?.parsed,
              walletName,
            };
          })();

    // TODO: validate settings

    this.log('TODO: run command');
  }
}
