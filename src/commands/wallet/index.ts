import { Command, flags } from '@oclif/command';

import { ReservedAlias } from '../../internal/configuration';
import { jsonFlag } from '../../internal/flags';

import WalletNew from './new';

export default class Wallet extends Command {
  static description = `list all wallets

Longer description here`;

  static aliases = ['wallets'];

  static examples = [
    `$ bitauth wallet
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    ...jsonFlag,
  };

  static args = [
    {
      description: 'wallet alias',
      name: 'WALLET_ALIAS',
    },
  ];

  async run() {
    const { args, flags: flag } = this.parse(Wallet);
    const walletAlias = args.WALLET_ALIAS as string | undefined;
    if (walletAlias === ReservedAlias.new) {
      await WalletNew.run([]);
    }
    if (flag.json) {
      // TODO: --json support
      this.log(`TODO`);
    }
    this.log(`wallet output`);
  }
}
