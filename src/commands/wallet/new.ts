import { AuthenticationTemplate } from '@bitauth/libauth';
import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { parseJsonFlagOrFail } from '../../internal/flags';
import { colors, toKebabCase } from '../../internal/formatting';
import { logger } from '../../internal/initialize';
import { getTemplates } from '../../internal/storage';

const bashEscapeSingleQuote = (bashString: string) =>
  bashString.replace(/\\/gu, '\\').replace(/'/gu, "'\\''");

export default class WalletNew extends Command {
  static description = `create a new wallet`;

  static examples = [
    `$ bitauth wallet:new\n${colors.dim('(interactive flow)')}\n`,
    `$ bitauth wallet:new 'Personal Wallet' --alias='personal' --template='p2pkh' --entity='owner'`,
    `$ bitauth wallet:new 'Business Wallet' --alias='business' --template='2-of-2-recoverable' --entity='signer_1' --wallet-data='{"delay_seconds":"2592000"}'`,
    `$ bitauth wallet:new 'Signing Oracle' --alias='oracle' --template-json='{"version": 0,"scripts:...' --entity='oracle' --address-data='[{"payment_number": 1},{"payment_number":2}]'`,
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
    'template-json': flags.string({
      description: 'the template to use in JSON format',
      exclusive: ['template', 'template-parameters'],
    }),
    'template-parameters': flags.string({
      dependsOn: ['template'],
      description:
        'the parameters to pass to a dynamic template (not yet supported)',
    }),
    'wallet-data': flags.string({
      description: 'an object containing the wallet data in JSON format',
    }),
  };

  static args = [
    {
      description: 'the name of the new wallet',
      name: 'WALLET_NAME',
    },
  ];

  // eslint-disable-next-line complexity
  async run() {
    const log = await logger;
    const { args, flags: flag } = this.parse(WalletNew);
    const walletNameArg = args.WALLET_NAME as string | undefined;

    const templatesPromise = getTemplates();
    const settings =
      walletNameArg === undefined
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
              walletName: walletNameArg,
            };
          })();

    const walletName = settings.walletName.trim();
    if (walletName === '') {
      return log.fatal('Please provide a wallet name.');
    }
    const walletAlias = settings.walletAlias ?? toKebabCase(walletName);
    const templates = await templatesPromise;

    if (flag['template-json'] !== undefined) {
      return log.fatal('Sorry, template-json is not yet supported.');
    }

    const { templateAlias, addressData, entityId, walletData } = settings;

    if (typeof templateAlias !== 'string') {
      return log.fatal(
        'Please provide a --template with which to create this wallet.'
      );
    }
    const template = templates[templateAlias] as
      | {
          template: AuthenticationTemplate;
          uniqueName: string;
        }
      | undefined;

    if (template === undefined) {
      return log.fatal(
        `A template with the alias '${templateAlias}' was not found in the current Bitauth data directory.`
      );
    }

    template.uniqueName;

    this.log('TODO: run command');
  }
}
