import path from 'path';
import { fileURLToPath } from 'url';
import { buildLoggerFromPino } from '@binocolo/backend/logging.js';
import { Service } from '@binocolo/backend/service.js';
// import openBrowser from 'react-dev-utils/openBrowser';
import pino from 'pino';
import { join, resolve } from 'path';
import { parseCommandLineArguments } from './cli-args.js';
import { promptForNewDataSourceSetSpecification, promptForNewDataSourceSpecification } from './interaction.js';
import { getDataSourceAdapterFromSpec, ServiceSpecs } from './data-sources.js';
import { LocalConfiguration } from './local-storage.js';

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

// const APPLICATION_DEFINITIONS: ApplicationDefinitions = {
//     cloud: {
//         knownProperties: [
//             {
//                 selector: '@timestamp',
//                 name: 'Timestamp',
//                 timestamp: true,
//                 width: 180,
//             },
//             {
//                 selector: 'severity',
//                 name: 'Lev',
//                 width: 50,
//                 knownValues: [
//                     {
//                         value: 'INFO',
//                     },
//                     {
//                         value: 'WARNING',
//                     },
//                     {
//                         value: 'ERROR',
//                         color: 'error',
//                     },
//                 ],
//             },
//             {
//                 selector: 'message',
//                 name: 'Message',
//                 grow: true,
//             },
//             {
//                 selector: 'fields.reqId',
//                 distinctColorsForValues: true,
//             },
//         ],
//         environments: {
//             production: {
//                 logGroupNames: ['convox-prod-cloud-gen2-LogGroup-WQBa068I8II9'],
//             },
//             ondeck: {
//                 logGroupNames: [],
//             },
//             staging: {
//                 logGroupNames: ['convox-rack-staging-cloud-gen2-LogGroup-swTx7IKUVDBP'],
//             },
//         },
//     },
//     rtc: {
//         knownProperties: [
//             {
//                 selector: '@timestamp',
//                 name: 'Timestamp',
//                 timestamp: true,
//                 width: 180,
//             },
//             {
//                 selector: 'severity',
//                 name: 'Lev',
//                 width: 50,
//                 knownValues: [
//                     {
//                         value: 'INFO',
//                     },
//                     {
//                         value: 'WARNING',
//                     },
//                     {
//                         value: 'ERROR',
//                         color: 'error',
//                     },
//                 ],
//             },
//             {
//                 selector: 'message',
//                 name: 'Message',
//                 grow: true,
//             },
//         ],
//         environments: {
//             production: {
//                 logGroupNames: ['/aws/lambda/rtc-production-gardening-function', '/aws/lambda/rtc-production-handler-function'],
//             },
//             ondeck: {
//                 logGroupNames: [],
//             },
//             staging: {
//                 logGroupNames: ['convox-rack-staging-cloud-gen2-LogGroup-swTx7IKUVDBP'],
//             },
//         },
//     },
// };

async function runCli(): Promise<void> {
    const logger = buildLoggerFromPino(pinoLogger);

    const localConfig = new LocalConfiguration({
        logger,
        verbose: true,
    });

    if (!(await localConfig.exists())) {
        console.log(`Local configuration missing. Creating a new one at ${localConfig.path}`);
        const { spec: dataSourceSpec } = await promptForNewDataSourceSpecification(await localConfig.getDataSourceSetDescriptors());
        localConfig.initialize(dataSourceSpec);
    }

    const command = parseCommandLineArguments();

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
                host: command.host,
                port: command.port,
                configurationStorage: localConfig,
                verbose: command.verbose,
                getDataSourceAdapterFromSpec,
                pinoLogger,
                staticRootDir: resolve(join(__dirname, '..', '..', 'frontend', 'build')),
            });
            service.runHTTPServer((url) => {
                if (!command.nobrowser) {
                    // openBrowser(url);
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
        default:
            const exhaustiveCheck: never = commandType;
            throw new Error(`Unhandled command.type: ${exhaustiveCheck}`);
    }
}

runCli().catch((err) => {
    console.error(err);
});
