import { Command, flags } from '@oclif/command';

import { environment } from '../internal/configuration';
import { jsonFlag } from '../internal/flags';
import { colors, formatJson } from '../internal/formatting';

export default class Config extends Command {
  static description = `Display current Bitauth configuration`;

  static flags = {
    help: flags.help({ char: 'h' }),
    ...jsonFlag,
  };

  async run() {
    const flag = this.parse(Config).flags;
    if (flag.json) {
      this.log(`${formatJson(environment)}`);
      return;
    }
    this.log(
      Object.entries(environment)
        .map(([variable, value]) => `${colors.bold(variable)}: ${value}`)
        .join('\n')
    );
  }
}
