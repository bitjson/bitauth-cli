import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { logger } from '../../internal/initialize';

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
    const settings =
      walletName === undefined
        ? await (async () => {
            const result = await interactiveCreateWallet();
            log.debug(`interactiveCreateWallet returned: %j`, result);
            return result;
          })()
        : (() => {
            // // parse and log

            /*
             * if(flag.addressData === undefined)
             * try {
             *   const addressData = JSON.parse(flag.addressData);
             * }
             */

            return {};
          })();

    /*
     * { addressData: ar } as { addressData: Record<string, string>[] | undefined;
     *   walletData: Record<string, string> | undefined;
     *   entityId: string;
     *   templateAlias: string;
     *   walletAlias: string;
     *   walletName: string;}
     */

    this.log('TODO: run command');
  }
}
