import { join } from 'path';

import {
  AuthenticationTemplate,
  validateAuthenticationTemplate,
} from '@bitauth/libauth';
import * as fg from 'fast-glob';
import { readFile, writeFile } from 'fs-extra';

import { DataDirectory, DefaultTemplates } from './configuration';
import {
  authenticationTemplateP2pkh,
  twoOfThree,
  twoOfTwoRecoverable,
} from './defaults';
import { formatJson } from './formatting';
import { bitauthDataDirectory, logger } from './initialize';

// TODO: read all `data_dir/wallets/*/wallet-secret.json`, if format is recognized, add to return array

// export const getWallets = () => {};

export const getTemplates = async () => {
  const dataDir = await bitauthDataDirectory;
  const templatesDir = join(dataDir, DataDirectory.templates);
  const log = await logger;

  const templatePaths = await fg(`${templatesDir}/*.json`);
  log.trace('Available template paths: %j', templatePaths);

  const templateContents = await Promise.all(
    templatePaths.map(async (path) => readFile(path, 'utf8'))
  ).catch((error) => {
    return log.fatal(
      `Failed to read template file: ${(error as { message: string }).message}`
    );
  });

  const templateStrings = templatePaths.reduce<{ [id: string]: string }>(
    (all, path, i) => ({
      ...all,
      [path
        .split('/')
        .slice(-1)[0]
        .replace(/\.json$/u, '')]: templateContents[i],
    }),
    {}
  );

  log.trace('Available template contents: %j', templateStrings);

  [
    [DefaultTemplates.p2pkh, formatJson(authenticationTemplateP2pkh)],
    [DefaultTemplates.twoOfThree, formatJson(twoOfThree)],
    [DefaultTemplates.twoOfTwoRecoverable, formatJson(twoOfTwoRecoverable)],
  ].map(async ([id, expectedContent]) => {
    if (templateStrings[id] === expectedContent) {
      log.trace(`Template "${id}" exists and has not been modified.`);
    } else {
      // eslint-disable-next-line functional/immutable-data
      templateStrings[id] = expectedContent;
      const path = join(templatesDir, `${id}.json`);
      log.debug(
        `Template "${id}" does not exist or was modified, re-writing to: ${path}`
      );
      await writeFile(path, expectedContent);
    }
  });

  const maybeTemplates = Object.entries(templateStrings).reduce<{
    [id: string]: unknown;
  }>((all, [alias, content]) => {
    // eslint-disable-next-line functional/no-try-statement
    try {
      return { ...all, [alias]: JSON.parse(content) as unknown };
    } catch (error) {
      return log.fatal(
        `Template is malformed – alias "${alias}": ${
          (error as { message: string }).message
        }`
      );
    }
  }, {});

  const templates = Object.entries(maybeTemplates).reduce<{
    [alias: string]: AuthenticationTemplate;
  }>((all, [alias, maybeTemplate]) => {
    const result = validateAuthenticationTemplate(maybeTemplate);
    if (typeof result === 'string') {
      return log.fatal(`Template is invalid – alias "${alias}": ${result}`);
    }
    return { ...all, [alias]: result };
  }, {});

  const nonUniqueNames = Object.entries(
    Object.values(templates)
      .filter((template) => template.name !== undefined)
      .map((template) => template.name as string)
      .reduce<{ [name: string]: number }>(
        (all, name) =>
          (all[name] as number | undefined) === undefined
            ? { ...all, [name]: 1 }
            : { ...all, [name]: all[name] + 1 },
        {}
      )
  )
    .filter(([_, occurrences]) => occurrences > 1)
    .map(([name]) => name);

  const templateListing = Object.entries(templates).reduce<{
    [id: string]: {
      template: AuthenticationTemplate;
      uniqueName: string;
    };
  }>(
    (all, [alias, template]) => ({
      ...all,
      [alias]: {
        template,
        uniqueName:
          template.name === undefined
            ? alias
            : nonUniqueNames.includes(template.name)
            ? `${template.name} [${alias}]`
            : template.name,
      },
    }),
    {}
  );

  return templateListing;
};
