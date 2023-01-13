import path from 'path';
import { fileURLToPath } from 'url';
import { IConnectionHandler, INetworkHandler, runHTTPServer, SenderFunction } from '@binocolo/backend/network.js';
import { QueryDescriptor, IDataSourceAdapter } from '@binocolo/backend/types.js';
import { BackendCommand, FetchEntriesCommand, LogTableConfigurationParams, RecordsScanningStats } from '@binocolo/common/common.js';
import { Logger, buildLoggerFromPino } from '@binocolo/backend/logging.js';
// import openBrowser from 'react-dev-utils/openBrowser';
import pino from 'pino';
import { join, resolve } from 'path';
import { parseCommandLineArguments } from './cli-args.js';
import { promptForNewDataSourceSpecification } from './interaction.js';
import { DataSourceSpecification, getDataSourceAdapterFromSpec } from './data-sources.js';
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

// const APPLICATIONS = ['cloud', 'rtc'] as const;
// type Application = (typeof APPLICATIONS)[number];
// const ENVIRONMENTS = ['production', 'ondeck', 'staging'] as const;
// type Environment = (typeof ENVIRONMENTS)[number];

// type ApplicationDefinitions = { [a in Application]: ApplicationDefinition };

// type ApplicationDefinition = {
//     environments: { [e in Environment]: EnvironmentDefinition };
//     knownProperties: DataSourceConfig['knownProperties'];
// };

// type EnvironmentDefinition = {
//     logGroupNames: string[];
// };

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

// const dataSources: DataSourceSpecification[] = [
// dataSourceSpec,
// {
//     id: 'dataSource',
//     name: `${application} ${environment}`,
//     adapter: {
//         type: 'AWSCloudWatch',
//         region: 'us-east-1',
//         logGroupNames: applicationDefinition.environments[environment].logGroupNames,
//     },
//     knownProperties: applicationDefinition.knownProperties,
//     initialQuery: {
//         timeRange: {
//             type: 'relative',
//             amount: 15,
//             specifier: 'minutes',
//         },
//         shownProperties: ['severity', 'message', 'fields.route.name'],
//         filters: [
//             {
//                 type: 'match',
//                 include: false,
//                 selector: 'fields.subsystem',
//                 values: ['redis', 'metrics', 'database', 'flushevents'],
//             },
//         ],
//     },
// },
// ];

type ServiceParams = {
    config: LogTableConfigurationParams;
    logger: Logger;
    port?: number;
    host?: string;
};

class Service implements INetworkHandler {
    constructor(private params: ServiceParams, private dataSourceAdaptersMap: DataSourceAdaptersMap) {}

    runHTTPServer(onStarted: (url: string) => void): void {
        runHTTPServer({
            host: this.params.host,
            port: this.params.port,
            pinoLogger: pinoLogger,
            handler: this,
            onStarted,
            staticRootDir: resolve(join(__dirname, '..', '..', 'frontend', 'build')),
        });
    }

    onConnected(send: SenderFunction): IConnectionHandler {
        return new ConnectionHandler(send, this.params.config, this.dataSourceAdaptersMap, this.params.logger);
    }
}

class ConnectionHandler implements IConnectionHandler {
    private query: QueryDescriptor | null;

    constructor(
        private send: SenderFunction,
        private logTableConfig: LogTableConfigurationParams,
        private dataSourceAdaptersMap: DataSourceAdaptersMap,
        private logger: Logger
    ) {
        this.query = null;
    }

    async start(): Promise<void> {
        await this.send({ type: 'configuration', params: this.logTableConfig });
    }

    async onMessage(command: BackendCommand): Promise<void> {
        switch (command.type) {
            case 'fetchEntries':
                return await this.fetchEntries(command);
            case 'stopQuery':
                this.stopQuery();
                return;
            default:
                const exhaustiveCheck: never = command;
                throw new Error(`Unhandled command.type: ${exhaustiveCheck}`);
        }
    }

    private getDataSourceById(dataSourceId: string): IDataSourceAdapter {
        const adapter = this.dataSourceAdaptersMap.get(dataSourceId);
        if (!adapter) {
            throw new Error(`Cannot find data source with ID ${dataSourceId}`);
        }
        return adapter;
    }

    private async fetchEntries({ timeRange, filters, histogramBreakdownProperty, dataSourceId }: FetchEntriesCommand): Promise<void> {
        let errorMessage: string | undefined = undefined;
        let stats: RecordsScanningStats | null | undefined = undefined;
        try {
            const dataSource = this.getDataSourceById(dataSourceId);
            stats = await dataSource.queryLogs({
                timeRange,
                filters,
                histogramBreakdownProperty,
                onStarted: (query) => {
                    this.query = query;
                },
                onData: async (entries) => {
                    await this.send({ type: 'sendEntries', entries });
                },
                onHistogram: async ({ elaboratedTimeRange, histogram }) => {
                    await this.send({ type: 'sendHistogram', elaboratedTimeRange, histogram });
                },
            });
            this.query = null;
        } catch (err) {
            this.logger.error('Unexpected error while fetching logs', err);
            errorMessage = (err as any).message;
        }
        await this.send({ type: 'doneLoadingEntries', errorMessage, stats: stats || undefined });
    }

    async close(): Promise<void> {
        this.stopQuery();
    }

    private stopQuery(): void {
        if (this.query) {
            this.query.stop();
            this.query = null;
        }
    }
}

const BALSAMIQ_CONFIGURATION: Pick<LogTableConfigurationParams, 'timezones' | 'timeRanges' | 'preambleProperties'> = {
    timezones: {
        defaultTimezone: 'EU',
        timezones: [
            {
                id: 'CA',
                description: 'California',
                timezone: 'America/Los_Angeles',
            },
            {
                id: 'IL',
                description: 'Illinois',
                timezone: 'America/Chicago',
            },
            {
                id: 'UTC',
                description: 'UTC',
                timezone: 'UTC',
            },
            {
                id: 'EU',
                description: 'Europe',
                timezone: 'Europe/Amsterdam',
            },
        ],
    },
    timeRanges: {
        months: [1, 2, 3],
        weeks: [1, 2, 3],
        days: [1, 2, 3, 4, 5, 6],
        hours: [1, 2, 3, 6, 8, 12],
        minutes: [1, 2, 3, 5, 10, 15, 30, 45],
    },
    preambleProperties: ['@timestamp'],
};

async function runCli(): Promise<void> {
    const localConfig = new LocalConfiguration();

    if (!(await localConfig.exists())) {
        console.log(`Local configuration missing. Creating a new one at ${localConfig.path}`);
        const dataSourceSpec = await promptForNewDataSourceSpecification();
        localConfig.initialize(dataSourceSpec);
    }

    const logger = buildLoggerFromPino(pinoLogger);

    const command = parseCommandLineArguments();

    const commandType = command.type;
    switch (commandType) {
        case 'addDataSource':
            const dataSourceSpec = await promptForNewDataSourceSpecification();
            try {
                localConfig.addDataSource(dataSourceSpec);
            } catch (err) {
                console.error(`ERROR: ${err}`);
            }
            break;
        case 'runServer':
            if (command.verbose) {
                logger.info(`Local configuration: ${localConfig.path}`);
            }
            const dataSources: DataSourceSpecification[] = localConfig.getDataSources();

            let dataSourceAdaptersMap: DataSourceAdaptersMap = new Map();
            const dataSourcesConfig: LogTableConfigurationParams['dataSources'] = [];
            for (let dataSourceSpec of dataSources) {
                const adapter = getDataSourceAdapterFromSpec(dataSourceSpec.adapter, logger, command.verbose);
                dataSourceAdaptersMap.set(dataSourceSpec.id, adapter);
                dataSourcesConfig.push({
                    id: dataSourceSpec.id,
                    name: dataSourceSpec.name,
                    ...adapter.specs,
                    knownProperties: dataSourceSpec.knownProperties,
                    initialQuery: adapter.defaultQuery,
                });
            }

            const CONFIG: LogTableConfigurationParams = {
                ...BALSAMIQ_CONFIGURATION,
                initialDataSourceId: localConfig.getCurrentDataSourceId(),
                dataSources: dataSourcesConfig,
            };

            const service = new Service(
                {
                    config: CONFIG,
                    logger,
                    host: command.host,
                    port: command.port,
                },
                dataSourceAdaptersMap
            );
            service.runHTTPServer((url) => {
                if (!command.nobrowser) {
                    // openBrowser(url);
                }
            });
            break;
        default:
            const exhaustiveCheck: never = commandType;
            throw new Error(`Unhandled command.type: ${exhaustiveCheck}`);
    }
}

type DataSourceAdaptersMap = Map<string, IDataSourceAdapter>;

runCli().catch((err) => {
    console.error(err);
});
