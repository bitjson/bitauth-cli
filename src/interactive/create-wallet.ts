import { binToHex, compileBtl, range } from '@bitauth/libauth';
import { Form, NumberPrompt, Select, StringPrompt } from 'enquirer';

import { DefaultTemplates, reservedAliasList } from '../internal/configuration';
import { colors, toKebabCase } from '../internal/formatting';
import { logger } from '../internal/initialize';
import { getTemplates } from '../internal/storage';

import { handleEnquirerError } from './interactive-helpers';

const logSpacer = () => {
  // eslint-disable-next-line no-console
  console.log();
};

const logFormResult = (
  result: Record<string, string>,
  mapping: { [id: string]: { name: string } }
) => {
  // eslint-disable-next-line no-console
  console.log(
    Object.entries(result)
      .map(([id, value]) => `${colors.dim(mapping[id].name)}: ${value}`)
      .join(' | ')
  );
  logSpacer();
};

// eslint-disable-next-line complexity
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
  const templateAlias = choiceToAlias[templateChoice];
  const selectedTemplate = templates[templateAlias];

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
  const entityId = templateEntityMap[selectedEntityName];

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
    entityId,
    templateAlias,
    walletAlias,
    walletName,
  };

  const requiredVariables =
    selectedTemplate.template.entities[entityId].variables;
  if (requiredVariables === undefined) {
    return walletParameters;
  }
  const partitionedVariables = Object.entries(requiredVariables).reduce<{
    addressData: { id: string; name: string; description: string }[];
    walletData: { id: string; name: string; description: string }[];
  }>(
    // eslint-disable-next-line complexity
    (all, entries) => {
      const [id, variable] = entries;
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
      if (variable.type === 'AddressData') {
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
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (variable.type !== 'Key' && variable.type !== 'HdKey') {
        log.fatal(
          `Template ${
            selectedTemplate.uniqueName
          } requires an unknown variable type: "${
            ((variable as unknown) as { type: string }).type
          }".`
        );
      }
      return all;
    },
    {
      addressData: [],
      walletData: [],
    }
  );

  logSpacer();

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

  const walletData = hasWalletData
    ? await (async () => {
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
            return colors.dim(walletDataById[currentFieldId].description);
          },
          header: () => {
            if (walletDataPrompt.focused === undefined) return '';
            const currentFieldValue = walletDataPrompt.focused.input;
            const result = compileBtl(currentFieldValue);
            return colors.dim(
              `Computed: ${
                typeof result === 'string' ? result : `0x${binToHex(result)}`
              }`
            );
          },
          message: 'Please provide the required wallet data:',
          validate: (inputs: Record<string, string>) => {
            const firstError = Object.entries(inputs)
              .map(([id, value]) => {
                if (value === '') {
                  return `The value for ${walletDataById[id].name} may not be empty.`;
                }
                const result = compileBtl(value);
                return typeof result === 'string'
                  ? `The current value for ${walletDataById[id].name} is invalid: ${result}`
                  : false;
              })
              .find((result): result is string => result !== false);
            return firstError === undefined ? true : firstError;
          },
        });
        const result = await walletDataPrompt.run().catch(handleEnquirerError);
        logFormResult(result, walletDataById);
        return result;
      })()
    : undefined;

  const initialAddressCount = hasAddressData
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
          logSpacer();
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
                  return colors.dim(
                    addressDataById[currentFieldId].description
                  );
                },
                header: () => {
                  if (addressDataPrompt.focused === undefined) return '';
                  const currentFieldValue = addressDataPrompt.focused.input;
                  const result = compileBtl(currentFieldValue);
                  return colors.dim(
                    `Computed: ${
                      typeof result === 'string'
                        ? result
                        : `0x${binToHex(result)}`
                    }`
                  );
                },
                message: `Please provide the address data for address ${addressIndex}:`,
                validate: (inputs: Record<string, string>) => {
                  const firstError = Object.entries(inputs)
                    .map(([id, value]) => {
                      if (value === '') {
                        return `The value for ${addressDataById[id].name} may not be empty.`;
                      }
                      const result = compileBtl(value);
                      return typeof result === 'string'
                        ? `The current value for ${addressDataById[id].name} is invalid: ${result}`
                        : false;
                    })
                    .find((result): result is string => result !== false);
                  return firstError === undefined ? true : firstError;
                },
              });
              return addressDataPrompt;
            }
          );

          const results: Record<string, string>[] = [];
          // eslint-disable-next-line functional/no-loop-statement
          for (const addressPrompt of addressPrompts) {
            // eslint-disable-next-line no-await-in-loop
            const result = await addressPrompt.run().catch(handleEnquirerError);
            logFormResult(result, addressDataById);
            // eslint-disable-next-line functional/immutable-data
            results.push(result);
          }
          return results;
        })();

  logSpacer();

  return {
    ...walletParameters,
    addressData,
    walletData,
  };
};
