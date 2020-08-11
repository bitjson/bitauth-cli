import { Command, flags } from '@oclif/command';

export default class Hello extends Command {
  static description = `some demo info

Longer description here`;

  static examples = [
    `$ bitauth hello
hello world from ./src/hello.ts!
`,
  ];

  static flags = {
    force: flags.boolean({ char: 'f' }),
    help: flags.help({ char: 'h' }),
    name: flags.string({ char: 'n', description: 'name to print' }),
  };

  static args = [{ name: 'file' }];

  async run() {
    const { args, flags: flag } = this.parse(Hello);
    const name = flag.name ?? 'world';
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    this.log(this.config.commandIDs.join());
    this.log(JSON.stringify(this.config.topics));

    if (args.file !== undefined && flag.force) {
      this.log(`you input --force and --file: ${args.file as string}`);
    }
  }
}
