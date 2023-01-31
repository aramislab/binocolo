import path from 'path';
import { fileURLToPath } from 'url';
import { buildLoggerFromConsole, buildLoggerFromPino } from '@binocolo/backend/logging.js';
import { Service } from '@binocolo/backend/service.js';
import { openBrowser } from './open-browser.js';
import pino from 'pino';
import { join, resolve } from 'path';
import { parseCommandLineArguments } from './cli-args.js';
import {
    editDataSource,
    editSavedSearch,
    promptForNewDataSourceSetSpecification,
    promptForNewDataSourceSpecification,
} from './interaction.js';
import { ServiceSpecs } from '@binocolo/serialization/types.js';
import { LocalConfiguration } from './local-storage.js';
import { getDataSourceAdapterFromSpec } from './data-sources.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pinoLogger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
        },
    },
});

const DEFAULT_PORT = 32652;

async function runCli(): Promise<void> {
    const logger = buildLoggerFromPino(pinoLogger);
    // const logger = buildLoggerFromConsole();

    const localConfig = new LocalConfiguration({
        logger,
        verbose: true,
    });

    const command = parseCommandLineArguments();

    if (!(await localConfig.exists())) {
        if (command.type !== 'addDataSource' && command.type !== 'addDataSourceSet') {
            console.log(`Local configuration missing. You must run either of the "addDataSource" or "addDataSourceSet" commands.`);
            return;
        }
        // const { spec: dataSourceSpec } = await promptForNewDataSourceSpecification(await localConfig.getDataSourceSetDescriptors());
        localConfig.initialize();
    }

    const commandType = command.type;
    switch (commandType) {
        case 'addDataSource':
            const { spec: dataSourceSpec, dataSourceSetId } = await promptForNewDataSourceSpecification(
                await localConfig.getDataSourceSetDescriptors()
            );
            try {
                const dataSourceSet = await localConfig.getDataSourceSetStorage(dataSourceSetId);
                await dataSourceSet.addDataSource(dataSourceSpec);
            } catch (err) {
                console.error(`ERROR: ${err}`);
            }
            break;
        case 'runServer':
            if (command.verbose) {
                logger.info(`Local configuration: ${localConfig.path}`);
            }
            const service = new Service<ServiceSpecs>({
                logger,
                host: command.host || '127.0.0.1',
                port: command.port || DEFAULT_PORT,
                configurationStorage: localConfig,
                verbose: command.verbose,
                getDataSourceAdapterFromSpec,
                pinoLogger,
                staticRootDir: resolve(join(__dirname, '..', 'frontend-build')),
            });
            service.runHTTPServer((url) => {
                if (!command.nobrowser) {
                    openBrowser(url);
                }
            });
            break;
        case 'addDataSourceSet':
            const dataSourceSetSpec = await promptForNewDataSourceSetSpecification();
            try {
                localConfig.addDataSourceSet(dataSourceSetSpec);
            } catch (err) {
                console.error(`ERROR: ${err}`);
            }
            break;
        case 'editDataSource':
            await editDataSource(localConfig);
            break;
        case 'editSavedSearch':
            await editSavedSearch(localConfig);
            break;
        default:
            const exhaustiveCheck: never = commandType;
            throw new Error(`Unhandled command.type: ${exhaustiveCheck}`);
    }
}

runCli().catch((err) => {
    console.error(err);
});
