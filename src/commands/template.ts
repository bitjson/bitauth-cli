import { Command, flags } from '@oclif/command';

import { DataDirectory, environment } from '../internal/configuration';
import { jsonFlag } from '../internal/flags';
import { colors, formatJson } from '../internal/formatting';
import { getTemplates } from '../internal/storage';

export default class Template extends Command {
  static description = `list available Bitauth templates`;

  static flags = {
    help: flags.help({ char: 'h' }),
    ...jsonFlag,
  };

  async run() {
    const templates = await getTemplates();
    const flag = this.parse(Template).flags;
    if (flag.json) {
      this.log(`${formatJson(templates)}`);
      return;
    }

    this.log(
      `\n${colors.bold('Available Bitauth Templates')}\n===\n${Object.entries(
        templates
      )
        .map(([_, template]) => template.uniqueName)
        .join('\n')}\n\nTo import a template, copy the template file into: ${
        environment.BITAUTH_DATA_DIR
      }/${DataDirectory.templates}`
      // TODO: bitauth template:import
    );
  }
}
