import { NumberPrompt, Select, StringPrompt } from 'enquirer';

import { DefaultTemplates, reservedAliasList } from '../internal/configuration';
import { colors, toKebabCase } from '../internal/formatting';
import { getTemplates } from '../internal/storage';

import { handleEnquirerError } from './interactive-helpers';

export const interactiveCreateWallet = async () => {
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

  const requiredVariables =
    selectedTemplate.template.entities[selectedEntityId].variables;
  if (requiredVariables !== undefined) {
    const hasAddressData = Object.values(requiredVariables).some(
      (variable) => variable.type === 'AddressData'
    );

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

    const variables = Object.entries(requiredVariables).map<
      | {
          variableId: string;
          filled: true;
          type: 'Key' | 'HdKey';
          value: string;
        }
      | {
          variableId: string;
          filled: false;
          type: 'AddressData' | 'HdKey';
          value: Promise<string>;
        }
    >(([variableId, variable]) => {
      if (variable.type === 'Key') {
      }
    });
  }

  return {
    requiredVariables,
    selectedEntityName,
    selectedTemplate,
    walletAlias,
    walletName,
  };
};