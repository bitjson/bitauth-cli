import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';

export default class WalletNew extends Command {
  static description = `create a new wallet

Longer description here`;

  static examples = [
    `$ bitauth wallet:new
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  static args = [
    {
      description: 'wallet alias',
      name: 'WALLET_ALIAS',
    },
    {
      description: 'authentication template alias',
      name: 'TEMPLATE_ALIAS',
    },
  ];

  async run() {
    const { args } = this.parse(WalletNew);
    const walletAlias = args.WALLET_ALIAS as string | undefined;
    if (walletAlias === undefined) {
      const result = await interactiveCreateWallet();
      this.log('result', result);
    }

    // TODO: disallow wallet alias of `new`

    this.log('TODO: run command');
  }
}
