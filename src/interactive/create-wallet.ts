import { Select, StringPrompt } from 'enquirer';

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
    name: 'type',
    type: 'select',
  });

  const templateChoice = await templatePrompt.run().catch(handleEnquirerError);
  const selectedTemplate = templates[choiceToAlias[templateChoice]];

  // TODO: allow js function templates, request all variables here

  // get entities which can create wallets (own at least one locking script) – if only one, we can skip to naming

  // TODO: determine ownership of locking scripts

  // TODO: if only one entity owns a locking script, that entity is automatically selected

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
    name: 'type',
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
    // TODO: fill any non-key variables (if AddressData is required, prompt to ask for number of initial addresses to create)

    const variables = Object.entries(
      requiredVariables
    ).map(([variableId, variable]) => {});
  }

  return {
    requiredVariables,
    selectedEntityName,
    selectedTemplate,
    walletAlias,
    walletName,
  };
};
