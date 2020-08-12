import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { logger } from '../../internal/initialize';

export default class WalletNew extends Command {
  static description = `create a new wallet

Longer description here`;

  static examples = [
    `$ bitauth wallet:new
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    alias: flags.string({ description: 'the alias of the new wallet' }),
    entity: flags.string({
      description: 'the role performed by the new wallet',
    }),
    help: flags.help({ char: 'h' }),
    template: flags.string({ description: 'the alias of the template to use' }),
    // "template-parameters": flags.string({description: 'the parameters to pass to a dynamic template'}),
    'wallet-data': flags.string({
      description: 'the wallet data in JSON',
    }),
  };

  static args = [
    {
      description: 'wallet name',
      name: 'WALLET_NAME',
    },
  ];

  async run() {
    const { args } = this.parse(WalletNew);
    const walletName = args.WALLET_NAME as string | undefined;
    if (walletName === undefined) {
      const result = await interactiveCreateWallet();
      (await logger).debug(`interactiveCreateWallet returned: %j`, result);
      // this.log('result', result);
    }

    this.log('TODO: run command');
  }
}
