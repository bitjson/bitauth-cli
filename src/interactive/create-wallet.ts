import { randomBytes } from 'crypto';

import {
  binToHex,
  compileBtl,
  encodeHdPrivateKey,
  generateHdPrivateNode,
  generatePrivateKey,
  instantiateSha256,
  instantiateSha512,
  range,
} from '@bitauth/libauth';
import { Form, NumberPrompt, Select, StringPrompt } from 'enquirer';

import { DefaultTemplates, reservedAliasList } from '../internal/configuration';
import { colors, toKebabCase } from '../internal/formatting';
import { logger } from '../internal/initialize';
import { getTemplates } from '../internal/storage';

import { handleEnquirerError } from './interactive-helpers';

export const interactiveCreateWallet = async () => {
  const log = await logger;
  const templates = await getTemplates();

  const defaultChoiceAlias = DefaultTemplates.p2pkh;
  const defaultChoice = templates[defaultChoiceAlias].uniqueName;
  const otherChoicesToAlias = Object.entries(templates)
    .filter(([alias]) => alias !== DefaultTemplates.p2pkh)
    .reduce<{ [name: string]: string }>(
      (all, [alias, listing]) => ({ ...all, [listing.uniqueName]: alias }),
      {}
    );
  const choiceToAlias = {
    ...otherChoicesToAlias,
    [defaultChoice]: defaultChoiceAlias,
  };
  const otherChoices = [...Object.keys(otherChoicesToAlias)].sort((a, b) =>
    a.localeCompare(b)
  );

  const templatePrompt: Select = new Select({
    choices: [
      defaultChoice,
      { role: 'separator', value: colors.dim('────') },
      ...otherChoices,
    ],
    footer: () => {
      if (templatePrompt.focused === undefined) return '';
      const selectedChoice = templatePrompt.focused.name;
      const selectedAlias = choiceToAlias[selectedChoice];
      const description = templates[selectedAlias].template.description ?? '';
      return `\n${description.split('\n')[0]}`;
    },
    hint: '(new wallet types can be added with `bitauth template`)',
    margin: [1, 0, 0, 1],
    message: 'What kind of wallet would you like to create?',
    type: 'select',
  });

  const templateChoice = await templatePrompt.run().catch(handleEnquirerError);
  const selectedTemplate = templates[choiceToAlias[templateChoice]];

  // TODO: allow js function templates, request all variables here

  // TODO: get entities which can create wallets (own at least one locking script) – separate into "recommended" and other entities

  const templateEntityMap = Object.entries(
    selectedTemplate.template.entities
  ).reduce<{ [name: string]: string }>(
    (all, [alias, entity]) => ({
      ...all,
      [entity.name ?? `Unnamed (${alias})`]: alias,
    }),
    {}
  );

  const entityPrompt: Select = new Select({
    choices: [...Object.keys(templateEntityMap)],
    footer: () => {
      if (entityPrompt.focused === undefined) return '';
      const selectedChoice = entityPrompt.focused.name;
      const selectedAlias = templateEntityMap[selectedChoice];
      const description =
        selectedTemplate.template.entities[selectedAlias].description ?? '';
      return `\n${description}`;
    },
    margin: [1, 0, 0, 1],
    message: 'Which role will be performed by this wallet?',
    type: 'select',
  });

  const selectedEntityName = await entityPrompt
    .run()
    .catch(handleEnquirerError);
  const selectedEntityId = templateEntityMap[selectedEntityName];

  const walletName = await new StringPrompt({
    hint: '(used in CLI output, e.g. "Personal Wallet")',
    message: 'Enter a name for this wallet',
    validate: (value) => (value.trim() === '' ? 'A name is required.' : true),
  })
    .run()
    .catch(handleEnquirerError);

  const walletAlias = await new StringPrompt({
    format: toKebabCase,
    hint: '(to refer to this wallet in CLI commands, e.g. "personal")',
    initial: toKebabCase(walletName),
    message: 'Choose an alias for this wallet',
    result: toKebabCase,
    validate: (value) =>
      value === ''
        ? 'An alias is required.'
        : (reservedAliasList as string[]).includes(value)
        ? `To avoid ambiguity, "${value}" cannot be an alias, please choose a different alias.`
        : true,
  })
    .run()
    .catch(handleEnquirerError);

  const walletParameters = {
    selectedEntityName,
    selectedTemplate,
    walletAlias,
    walletName,
  };

  const requiredVariables =
    selectedTemplate.template.entities[selectedEntityId].variables;
  if (requiredVariables === undefined) {
    return walletParameters;
  }

  const [sha256, sha512] = await Promise.all([
    instantiateSha256(),
    instantiateSha512(),
  ]);
  const keyLength = 32;
  const random32Bytes = () => randomBytes(keyLength);
  const partitionedVariables = Object.entries(requiredVariables).reduce<{
    addressData: { id: string; name: string; description: string }[];
    hdKeys: { id: string; value: string }[];
    keys: { id: string; value: Uint8Array }[];
    walletData: { id: string; name: string; description: string }[];
  }>(
    // eslint-disable-next-line complexity
    (all, entries) => {
      const [id, variable] = entries;
      if (variable.type === 'Key') {
        return {
          ...all,
          keys: [
            ...all.keys,
            {
              id,
              value: generatePrivateKey(random32Bytes),
            },
          ],
        };
      }
      if (variable.type === 'HdKey') {
        return {
          ...all,
          hdKeys: [
            ...all.hdKeys,
            {
              id,
              value: encodeHdPrivateKey(
                { sha256 },
                {
                  network: 'mainnet',
                  node: generateHdPrivateNode({ sha512 }, random32Bytes),
                }
              ),
            },
          ],
        };
      }
      if (variable.type === 'WalletData') {
        return {
          ...all,
          walletData: [
            ...all.walletData,
            {
              description: variable.description ?? '',
              id,
              name: variable.name ?? id,
            },
          ],
        };
      }
      if ((variable.type as unknown) !== 'AddressData') {
        log.fatal(
          `Template ${selectedTemplate.uniqueName} requires an unknown variable type: "${variable.type}".`
        );
      }
      return {
        ...all,
        addressData: [
          ...all.addressData,
          {
            description: variable.description ?? '',
            id,
            name: variable.name ?? id,
          },
        ],
      };
    },
    {
      addressData: [],
      hdKeys: [],
      keys: [],
      walletData: [],
    }
  );

  const hasWalletData = partitionedVariables.walletData.length > 0;
  const walletData = hasWalletData
    ? await (async () => {
        // fill wallet data first
        const walletDataById = partitionedVariables.walletData.reduce<{
          [id: string]: {
            id: string;
            name: string;
            description: string;
          };
        }>((all, variable) => ({ ...all, [variable.id]: variable }), {});
        const walletDataPrompt: Form = new Form({
          choices: partitionedVariables.walletData.map((variable) => ({
            message: variable.name,
            name: variable.id,
          })),
          footer: () => {
            if (walletDataPrompt.focused === undefined) return '';
            const currentFieldId = walletDataPrompt.focused.name;
            return walletDataById[currentFieldId].description;
          },
          header: () => {
            if (walletDataPrompt.focused === undefined) return '';
            const currentFieldValue = walletDataPrompt.focused.input;
            const result = compileBtl(currentFieldValue);
            return `Computed: ${
              typeof result === 'string' ? result : `0x${binToHex(result)}`
            }`;
          },
          message: 'Please provide the require wallet data:',
        });
        return walletDataPrompt.run().catch(handleEnquirerError);
      })()
    : undefined;

  const initialAddressCount =
    partitionedVariables.addressData.length > 0
      ? await new NumberPrompt({
          header:
            'This wallet type requires some additional data to generate each address.',
          initial: 1,
          message: 'How many addresses would you like to pre-generate?',
          validate: (number) => (number < 1 ? 'Must be greater than 0.' : true),
        })
          .run()
          .catch(handleEnquirerError)
      : undefined;

  const addressData =
    initialAddressCount === undefined
      ? undefined
      : await (async () => {
          // fill wallet data first
          const addressDataById = partitionedVariables.addressData.reduce<{
            [id: string]: {
              id: string;
              name: string;
              description: string;
            };
          }>((all, variable) => ({ ...all, [variable.id]: variable }), {});

          const addressPrompts = range(initialAddressCount).map(
            (addressIndex) => {
              const addressDataPrompt: Form = new Form({
                choices: partitionedVariables.addressData.map((variable) => ({
                  message: variable.name,
                  name: variable.id,
                })),
                footer: () => {
                  if (addressDataPrompt.focused === undefined) return '';
                  const currentFieldId = addressDataPrompt.focused.name;
                  return addressDataById[currentFieldId].description;
                },
                header: () => {
                  if (addressDataPrompt.focused === undefined) return '';
                  const currentFieldValue = addressDataPrompt.focused.input;
                  const result = compileBtl(currentFieldValue);
                  return `Computed: ${
                    typeof result === 'string'
                      ? result
                      : `0x${binToHex(result)}`
                  }`;
                },
                message: `Please provide the address data for address ${addressIndex}:`,
              });
              return addressDataPrompt;
            }
          );

          const results: { [id: string]: string }[] = [];
          // eslint-disable-next-line functional/no-loop-statement
          for (const addressPrompt of addressPrompts) {
            // eslint-disable-next-line functional/immutable-data
            results.push(
              // eslint-disable-next-line no-await-in-loop
              await addressPrompt.run().catch(handleEnquirerError)
            );
          }
          return results;
        })();

  return {
    ...walletParameters,
  };
};
