import { randomBytes } from 'crypto';

import {
  AuthenticationTemplate,
  AuthenticationTemplateEntity,
  binToHex,
  CompilerDefaults,
  deriveHdPath,
  deriveHdPublicNode,
  encodeHdPrivateKey,
  encodeHdPublicKey,
  generateHdPrivateNode,
  generatePrivateKey,
  instantiateRipemd160,
  instantiateSecp256k1,
  instantiateSha256,
  instantiateSha512,
  validateAuthenticationTemplate,
} from '@bitauth/libauth';
import { Command, flags } from '@oclif/command';

import { interactiveCreateWallet } from '../../interactive/create-wallet';
import { parseJsonFlagOrFail } from '../../internal/flags';
import {
  bashEscapeSingleQuote,
  colors,
  formatJsonForSigning,
  toKebabCase,
} from '../../internal/formatting';
import { logger } from '../../internal/initialize';
import { getTemplates } from '../../internal/storage';

const ripemd160Promise = instantiateRipemd160();
const secp256k1Promise = instantiateSecp256k1();
const sha256Promise = instantiateSha256();
const sha512Promise = instantiateSha512();

const keyLength = 32;
const random32Bytes = () => Uint8Array.from(randomBytes(keyLength));

/**
 * Ensure that `dataItem` is an object which contains all `expectedKeys`, has no
 * unexpected keys, and all values are strings.
 */
const verifyDataItem = (
  dataItem: unknown,
  expectedKeys: string[]
): string[] | { [key: string]: string } => {
  if (typeof dataItem !== 'object' || dataItem === null) {
    return ['Must be an object.'];
  }

  const includedKeys = Object.keys(dataItem);
  const missingKeys = expectedKeys.map((expected) =>
    includedKeys.includes(expected)
      ? null
      : `Missing required key: '${expected}'.`
  );

  const invalidKeys = Object.entries(dataItem).map(
    (entry: [string, unknown]) => {
      const [key, value] = entry;
      if (typeof value !== 'string') {
        return `Invalid key: '${key}' must be a BTL-encoded string.`;
      }
      if (!expectedKeys.includes(key)) {
        return `Unexpected key: ${key}.`;
      }
      return null;
    }
  );

  const errors = [...missingKeys, ...invalidKeys].filter(
    (result): result is string => result !== null
  );

  return errors.length > 0 ? errors : (dataItem as { [key: string]: string });
};

/**
 * Ensure that `addressData` is an array and that every element satisfies
 * `verifyDataItem`.
 */
const verifyAddressData = (
  addressData: unknown,
  expectedKeys: string[]
):
  | { success: false; errors: string[] }
  | { success: true; addressData: { [key: string]: string }[] } => {
  if (!Array.isArray(addressData)) {
    return {
      errors: ['Must be an array of address data objects.'],
      success: false,
    };
  }
  const errors = addressData
    .map((item, i) => {
      const result = verifyDataItem(item, expectedKeys);
      if (Array.isArray(result)) {
        return `Invalid address data at index ${i}: ${result.join(' ')}`;
      }
      return null;
    })
    .filter((result): result is string => result !== null);

  return errors.length > 0
    ? { errors, success: false }
    : {
        addressData: addressData as { [key: string]: string }[],
        success: true,
      };
};

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

    const partitionedVariables = Object.entries(entity.variables).reduce<{
      addressData: string[];
      walletData: string[];
      keys: string[];
      requiresHdKey: boolean;
      hdPublicKeyDerivationPath: string;
    }>(
      // eslint-disable-next-line complexity
      (all, entries) => {
        const [id, variable] = entries;
        if (variable.type === 'WalletData') {
          return { ...all, walletData: [...all.walletData, id] };
        }
        if (variable.type === 'AddressData') {
          return { ...all, addressData: [...all.addressData, id] };
        }
        if (variable.type === 'Key') {
          return { ...all, keys: [...all.keys, id] };
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (variable.type !== 'HdKey') {
          log.fatal(
            `The provided template requires an unknown variable type: "${
              (variable as { type: string }).type
            }".`
          );
        }
        return {
          ...all,
          hdPublicKeyDerivationPath:
            variable.hdPublicKeyDerivationPath ?? all.hdPublicKeyDerivationPath,
          requiresHdKey: true,
        };
      },
      {
        addressData: [],
        hdPublicKeyDerivationPath: CompilerDefaults.hdKeyHdPublicKeyDerivationPath as string,
        keys: [],
        requiresHdKey: false,
        walletData: [],
      }
    );

    const hasAddressData = partitionedVariables.addressData.length > 0;
    const hasWalletData = partitionedVariables.walletData.length > 0;

    if (hasAddressData || hasWalletData) {
      // eslint-disable-next-line no-console
      console.log(
        colors.bold.red(
          'WARNING: this wallet template requires custom variables – Bitauth CLI does not yet support "dry-run" testing, so invalid variables may permanently prevent funds from being spendable. Test this wallet carefully before using it on mainnet.'
        )
      );
    }

    const walletDataResult = hasWalletData
      ? verifyDataItem(walletData, partitionedVariables.walletData)
      : undefined;

    if (Array.isArray(walletDataResult)) {
      return log.fatal(
        `The provided wallet data is invalid: ${walletDataResult.join(' ')}`
      );
    }

    const addressDataResult = hasAddressData
      ? verifyAddressData(addressData, partitionedVariables.addressData)
      : undefined;

    if (addressDataResult !== undefined && !addressDataResult.success) {
      return log.fatal(
        `The provided address data is invalid: ${addressDataResult.errors.join(
          ' '
        )}`
      );
    }

    const [ripemd160, secp256k1, sha256, sha512] = await Promise.all([
      ripemd160Promise,
      secp256k1Promise,
      sha256Promise,
      sha512Promise,
    ]);

    const getKeyPair = (id: string) => {
      const privateKey = generatePrivateKey(random32Bytes);
      const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
      return { id, privateKey, publicKey };
    };
    const keys = partitionedVariables.keys.map(getKeyPair);

    const hasMultipleEntities = Object.keys(template.entities).length > 1;
    const entityMessagingKey = hasMultipleEntities
      ? getKeyPair('entityMessagingKey')
      : undefined;

    const privateKeys = keys.reduce(
      (all, pair) => ({ ...all, [pair.id]: pair.privateKey }),
      {}
    );
    const publicKeys = keys.reduce(
      (all, pair) => ({ ...all, [pair.id]: pair.publicKey }),
      {}
    );

    const hdKey = partitionedVariables.requiresHdKey
      ? (() => {
          const { node, seed } = generateHdPrivateNode(
            { sha512 },
            random32Bytes
          );
          const privateKey = encodeHdPrivateKey(
            { sha256 },
            { network: 'mainnet', node }
          );
          const publicKeyDerivationPathPrivateNode = deriveHdPath(
            { ripemd160, secp256k1, sha256, sha512 },
            node,
            partitionedVariables.hdPublicKeyDerivationPath
          );
          if (typeof publicKeyDerivationPathPrivateNode === 'string') {
            return log.fatal(
              `There was a problem deriving the HD public key: ${publicKeyDerivationPathPrivateNode}`
            );
          }
          const publicKey = encodeHdPublicKey(
            { sha256 },
            {
              network: 'mainnet',
              node: deriveHdPublicNode(
                { secp256k1 },
                publicKeyDerivationPathPrivateNode
              ),
            }
          );
          return {
            privateKey,
            publicKey,
            seed,
          };
        })()
      : undefined;

    const walletShare = {
      [entityId]: {
        addressData: addressDataResult?.addressData,
        createdAt: new Date().toISOString(),
        hdPublicKey: hdKey?.publicKey,
        publicKeys,
        template,
        templateAlias,
        walletAlias,
        walletData: walletDataResult,
        walletName,
      },
    };

    const walletShareSigningSerialization = formatJsonForSigning(walletShare);

    const proposal = {
      messagingKeys: entityMessagingKey
        ? {
            [entityId]: entityMessagingKey.publicKey,
          }
        : undefined,
      shareSignatures: {},
      walletShares: {
        [entityId]: walletShare,
      },
    };

    const walletSecret = {
      privateData: {
        hdKey:
          hdKey === undefined
            ? undefined
            : {
                private: hdKey.privateKey,
                seed: hdKey.seed,
              },
        messagingKey: entityMessagingKey?.privateKey,
        privateKeys,
      },
      proposal,
    };

    // fill key values

    // output `wallet-secret.json` - keep keys in separate property from wallet data (to make more interchangeable once wallet groups land)

    // output `${workingDirectory}/${alias}-wallet-proposal.json` with everything but the keys.

    this.log('TODO: run command');
    return undefined;
  }
}
