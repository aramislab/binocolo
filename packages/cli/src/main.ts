import { Command, Option } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { IConnectionHandler, INetworkHandler, runHTTPServer, SenderFunction } from '@binocolo/backend/network.js';
import {
    BackendCommand,
    DataSourceConfig,
    FetchEntriesCommand,
    LogTableConfigurationParams,
    RecordsScanningStats,
} from '@binocolo/common/common.js';
import { MIN } from '@binocolo/common/types.js';
import { AWS_CLOUDWATCH_CONFIGURATION, CloudwatchLogsAdapter, QueryDescriptor } from '@binocolo/aws/aws-adapter.js';
import { Logger, buildLoggerFromPino } from '@binocolo/backend/logging.js';
// import openBrowser from 'react-dev-utils/openBrowser';
import pino from 'pino';
import { join, resolve } from 'path';

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

const APPLICATIONS = ['cloud', 'rtc'] as const;
type Application = (typeof APPLICATIONS)[number];
const ENVIRONMENTS = ['production', 'ondeck', 'staging'] as const;
type Environment = (typeof ENVIRONMENTS)[number];

type ApplicationDefinitions = { [a in Application]: ApplicationDefinition };

type ApplicationDefinition = {
    environments: { [e in Environment]: EnvironmentDefinition };
    config: Pick<DataSourceConfig, 'shownProperties' | 'knownProperties'>;
};

type EnvironmentDefinition = {
    logGroupNames: string[];
};

const APPLICATION_DEFINITIONS: ApplicationDefinitions = {
    cloud: {
        config: {
            shownProperties: ['severity', 'message', 'fields.route.name'],
            knownProperties: [
                {
                    selector: '@timestamp',
                    name: 'Timestamp',
                    timestamp: true,
                    width: 180,
                },
                {
                    selector: 'severity',
                    name: 'Lev',
                    width: 50,
                    knownValues: [
                        {
                            value: 'INFO',
                        },
                        {
                            value: 'WARNING',
                        },
                        {
                            value: 'ERROR',
                            color: 'error',
                        },
                    ],
                },
                {
                    selector: 'message',
                    name: 'Message',
                    grow: true,
                },
                {
                    selector: 'fields.reqId',
                    distinctColorsForValues: true,
                },
            ],
        },
        environments: {
            production: {
                logGroupNames: ['convox-prod-cloud-gen2-LogGroup-WQBa068I8II9'],
            },
            ondeck: {
                logGroupNames: [],
            },
            staging: {
                logGroupNames: ['convox-rack-staging-cloud-gen2-LogGroup-swTx7IKUVDBP'],
            },
        },
    },
    rtc: {
        config: {
            shownProperties: ['severity', 'message', 'fields.route.name'],
            knownProperties: [
                {
                    selector: '@timestamp',
                    name: 'Timestamp',
                    timestamp: true,
                    width: 180,
                },
                {
                    selector: 'severity',
                    name: 'Lev',
                    width: 50,
                    knownValues: [
                        {
                            value: 'INFO',
                        },
                        {
                            value: 'WARNING',
                        },
                        {
                            value: 'ERROR',
                            color: 'error',
                        },
                    ],
                },
                {
                    selector: 'message',
                    name: 'Message',
                    grow: true,
                },
            ],
        },
        environments: {
            production: {
                logGroupNames: ['/aws/lambda/rtc-production-gardening-function', '/aws/lambda/rtc-production-handler-function'],
            },
            ondeck: {
                logGroupNames: [],
            },
            staging: {
                logGroupNames: ['convox-rack-staging-cloud-gen2-LogGroup-swTx7IKUVDBP'],
            },
        },
    },
};

type ServiceParams = {
    config: LogTableConfigurationParams;
    logger: Logger;
    logGroupName: string[];
    port?: number;
    host?: string;
    verbose?: boolean;
};

class Service implements INetworkHandler {
    private readonly cloudwatchLogs: CloudwatchLogsAdapter;

    constructor(private params: ServiceParams) {
        this.cloudwatchLogs = new CloudwatchLogsAdapter({
            region: 'us-east-1',
            logger: params.logger,
            verbose: params.verbose,
            logGroupNames: params.logGroupName,
        });
    }

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
        return new ConnectionHandler(send, this.params.config, this.cloudwatchLogs, this.params.logger);
    }
}

class ConnectionHandler implements IConnectionHandler {
    private query: QueryDescriptor | null;
    constructor(
        private send: SenderFunction,
        private logTableConfig: LogTableConfigurationParams,
        private cloudwatchLogs: CloudwatchLogsAdapter,
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

    private async fetchEntries({ timeRange, filters, histogramBreakdownProperty }: FetchEntriesCommand): Promise<void> {
        let errorMessage: string | undefined = undefined;
        let stats: RecordsScanningStats | null | undefined = undefined;
        try {
            stats = await this.cloudwatchLogs.runCloudWatchLogsQuery({
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

function runCli(): void {
    const program = new Command();
    program.name('binoculog').description('Binoculog CLI').version('0.1.0');
    // program
    //     .command('split')
    //     .description('Split a string into substrings and display as an array')
    //     .argument('<string>', 'string to split')
    //     .option('--first', 'display just the first substring')
    //     .option('-s, --separator <char>', 'separator character', ',')
    //     .action((str, options) => {
    //         const limit = options.first ? 1 : undefined;
    //         console.log(str.split(options.separator, limit));
    //     });
    program.addOption(new Option('-a, --application <application>', 'Application').choices(APPLICATIONS).makeOptionMandatory(true));
    program.addOption(new Option('-e, --environment <environment>', 'Environment').choices(ENVIRONMENTS).makeOptionMandatory(true));
    program.option('-p, --port <port>', 'Port to listen to (default picks the first available open port)');
    program.option('-h, --host <host>', 'Address to bind (defaults to localhost)');
    program.option('-v, --verbose', 'Show verbose log');
    program.option('-n, --nobrowser', 'Do not open browser');
    program.parse();

    const opts = program.opts();
    const application: Application = opts.application;
    const environment: Environment = opts.environment;
    const verbose: boolean = !!opts.verbose;

    const applicationDefinition = APPLICATION_DEFINITIONS[application];

    const end = new Date().getTime();
    const start = end - 15 * MIN;
    const CONFIG: LogTableConfigurationParams = {
        ...BALSAMIQ_CONFIGURATION,
        initialDataSourceId: 'dataSource',
        dataSources: [
            {
                id: 'dataSource',
                name: `${application} ${environment}`,
                ...AWS_CLOUDWATCH_CONFIGURATION,
                ...applicationDefinition.config,
                initialQuery: {
                    timeRange: {
                        start,
                        end,
                    },
                    filters: [
                        {
                            type: 'match',
                            include: false,
                            selector: 'fields.subsystem',
                            values: ['redis', 'metrics', 'database', 'flushevents'],
                        },
                    ],
                },
            },
        ],
    };

    const logger = buildLoggerFromPino(pinoLogger);

    const service = new Service({
        config: CONFIG,
        logger,
        logGroupName: applicationDefinition.environments[environment].logGroupNames,
        verbose,
        host: opts.host,
        port: opts.port,
    });
    service.runHTTPServer((url) => {
        if (!opts.nobrowser) {
            // openBrowser(url);
        }
    });
}

runCli();
