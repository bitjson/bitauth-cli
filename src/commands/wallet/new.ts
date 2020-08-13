import {
  AuthenticationTemplate,
  AuthenticationTemplateEntity,
  validateAuthenticationTemplate,
} from '@bitauth/libauth';
import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { parseJsonFlagOrFail } from '../../internal/flags';
import {
  bashEscapeSingleQuote,
  colors,
  toKebabCase,
} from '../../internal/formatting';
import { logger } from '../../internal/initialize';
import { getTemplates } from '../../internal/storage';

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
            return { ...result, template: undefined };
          })()
        : await (async () => {
            const addressData = await parseJsonFlagOrFail(flag, 'address-data');
            const walletData = await parseJsonFlagOrFail(flag, 'wallet-data');
            const templateJson = await parseJsonFlagOrFail(
              flag,
              'template-json'
            );
            const template =
              templateJson === undefined
                ? undefined
                : validateAuthenticationTemplate(templateJson.parsed);
            if (typeof template === 'string') {
              return log.fatal(
                `The template provided via --template-json is not valid: ${template}`
              );
            }
            return {
              addressData: addressData?.parsed,
              entityId: flag.entity,
              template,
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

    const { templateAlias, addressData, entityId, walletData } = settings;

    const foundTemplateDetails =
      typeof templateAlias === 'string'
        ? (templates[templateAlias] as
            | {
                template: AuthenticationTemplate;
                uniqueName: string;
              }
            | undefined)
        : undefined;

    if (templateAlias !== undefined && foundTemplateDetails === undefined) {
      return log.fatal(
        `A template with the alias '${templateAlias}' was not found in the current Bitauth data directory.`
      );
    }
    const template = foundTemplateDetails?.template ?? settings.template;
    if (template === undefined) {
      return log.fatal(
        `No template was provided. Please provide a template using either --template or --template-json.`
      );
    }

    if (typeof entityId !== 'string') {
      return log.fatal(
        `No entity was provided. Please indicate the role to be performed by this wallet using --entity.`
      );
    }

    const entity = template.entities[entityId] as
      | AuthenticationTemplateEntity
      | undefined;

    if (entity === undefined) {
      return log.fatal(
        `An entity with an ID of ${entityId} is not available in this template.`
      );
    }

    const partitionedVariables =
      entity.variables === undefined
        ? undefined
        : Object.entries(entity.variables).reduce<{
            addressData: { id: string }[];
            walletData: { id: string }[];
            keys: { id: string }[];
            requiresHdKey: boolean;
          }>(
            (all, entries) => {
              const [id, variable] = entries;
              if (variable.type === 'WalletData') {
                return { ...all, walletData: [...all.walletData, { id }] };
              }
              if (variable.type === 'AddressData') {
                return { ...all, addressData: [...all.addressData, { id }] };
              }
              if (variable.type === 'Key') {
                return { ...all, keys: [...all.keys, { id }] };
              }
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (variable.type !== 'HdKey') {
                log.fatal(
                  `The provided template requires an unknown variable type: "${
                    (variable as { type: string }).type
                  }".`
                );
              }
              return { ...all, requiresHdKey: true };
            },
            {
              addressData: [],
              keys: [],
              requiresHdKey: false,
              walletData: [],
            }
          );

    if (partitionedVariables === undefined) {
      // TODO:
      return undefined;
    }

    const hasAddressData = partitionedVariables.addressData.length > 0;
    const hasWalletData = partitionedVariables.walletData.length > 0;

    if (hasAddressData || hasWalletData) {
      // eslint-disable-next-line no-console
      console.log(
        colors.bold.red(
          'WARNING: this wallet template requires custom variables – Bitauth CLI does not yet support "dry-run" testing, so invalid variables may prevent funds from being spendable. Test this wallet carefully before using it on mainnet.'
        )
      );
    }

    // check that all address data and wallet data is provided (and no unexpected properties were provided)

    // fill key values

    // output `wallet-secret.json` - keep keys in separate property from wallet data (to make more interchangeable once wallet groups land)

    // output `${workingDirectory}/${alias}-wallet-invitation.json` with everything but the keys.

    this.log('TODO: run command');
    return undefined;
  }
}
