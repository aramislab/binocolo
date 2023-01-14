import { Logger as PinoLogger } from 'pino';
import { Logger } from './logging.js';
import { PropertyConfiguration } from '@binocolo/common/common.js';
import { QueryDescriptor, IDataSourceAdapter } from './types.js';
import { IDataSourceSpecificationsStorage } from './types.js';
import { IConnectionHandler, INetworkHandler, runHTTPServer, SenderFunction } from './network.js';
import { BackendCommand, FetchEntriesCommand, LogTableConfigurationParams, RecordsScanningStats } from '@binocolo/common/common.js';

export type DataSourceSpecification<DataSourceAdapterSpecification> = {
    id: string;
    name: string;
    adapter: DataSourceAdapterSpecification;
    knownProperties: PropertyConfiguration[];
};

type getDataSourceAdapterFromSpec<DataSourceAdapterSpecification> = (
    spec: DataSourceAdapterSpecification,
    logger: Logger,
    verbose: boolean
) => IDataSourceAdapter;

type ServiceParams<DataSourceSetSpecification, DataSourceAdapterSpecification> = {
    logger: Logger;
    pinoLogger: PinoLogger;
    port?: number;
    host?: string;
    configurationStorage: IConfigurationStorage<DataSourceSetSpecification, DataSourceAdapterSpecification>;
    verbose: boolean;
    getDataSourceAdapterFromSpec: getDataSourceAdapterFromSpec<DataSourceAdapterSpecification>;
    staticRootDir: string;
};

export type DataSourceSetDescriptor<DataSourceSetSpecification> = {
    id: string;
    name: string;
    spec: DataSourceSetSpecification;
};

export interface IConfigurationStorage<DataSourceSetSpecification, DataSourceAdapterSpecification> {
    getDataSourceSetDescriptors(): Promise<DataSourceSetDescriptor<DataSourceSetSpecification>[]>;
    getDataSourceSetStorage(
        setId: string
    ): Promise<IDataSourceSpecificationsStorage<DataSourceSpecification<DataSourceAdapterSpecification>>>;
    getCurrentDataSourceId(): Promise<string>;
    getDataSources(): Promise<DataSourceSpecification<DataSourceAdapterSpecification>[]>;
    setCurrentDataSourceId(dataSourceId: string): Promise<void>;
}

export class Service<DataSourceSetSpecification, DataSourceAdapterSpecification> implements INetworkHandler {
    constructor(private params: ServiceParams<DataSourceSetSpecification, DataSourceAdapterSpecification>) {}

    runHTTPServer(onStarted: (url: string) => void): void {
        runHTTPServer({
            host: this.params.host,
            port: this.params.port,
            pinoLogger: this.params.pinoLogger,
            handler: this,
            onStarted,
            staticRootDir: this.params.staticRootDir,
        });
    }

    onConnected(send: SenderFunction): IConnectionHandler {
        return new ConnectionHandler(
            send,
            this.params.logger,
            this.params.configurationStorage,
            this.params.verbose,
            this.params.getDataSourceAdapterFromSpec
        );
    }
}

type DataSourceAdaptersMap = Map<string, IDataSourceAdapter>;

class ConnectionHandler<DataSourceSetSpecification, DataSourceAdapterSpecification> implements IConnectionHandler {
    private query: QueryDescriptor | null;
    private dataSourceAdaptersMap: DataSourceAdaptersMap;

    constructor(
        private send: SenderFunction,
        private logger: Logger,
        private configurationStorage: IConfigurationStorage<DataSourceSetSpecification, DataSourceAdapterSpecification>,
        private verbose: boolean,
        private getDataSourceAdapterFromSpec: getDataSourceAdapterFromSpec<DataSourceAdapterSpecification>
    ) {
        this.query = null;
        this.dataSourceAdaptersMap = new Map();
    }

    async start(): Promise<void> {
        const dataSourceSets = await this.configurationStorage.getDataSourceSetDescriptors();
        const dataSourcesConfig: LogTableConfigurationParams['dataSources'] = [];
        for (let dataSourceSetSpec of dataSourceSets) {
            let dataSourceSet = await this.configurationStorage.getDataSourceSetStorage(dataSourceSetSpec.id);
            const dataSources: DataSourceSpecification<DataSourceAdapterSpecification>[] = await dataSourceSet.getDataSources();
            for (let dataSourceSpec of dataSources) {
                const adapter = this.getDataSourceAdapterFromSpec(dataSourceSpec.adapter, this.logger, this.verbose);
                const id = `${dataSourceSetSpec.id}:${dataSourceSpec.id}`;
                this.dataSourceAdaptersMap.set(id, adapter);
                dataSourcesConfig.push({
                    id,
                    name: `${dataSourceSetSpec.name}/${dataSourceSpec.name}`,
                    ...adapter.specs,
                    knownProperties: dataSourceSpec.knownProperties,
                    initialQuery: adapter.defaultQuery,
                });
            }
        }
        const config: LogTableConfigurationParams = {
            ...DEFAULT_CONFIGURATION,
            initialDataSourceId: await this.configurationStorage.getCurrentDataSourceId(),
            dataSources: dataSourcesConfig,
        };
        await this.send({ type: 'configuration', params: config });
    }

    async onMessage(command: BackendCommand): Promise<void> {
        switch (command.type) {
            case 'fetchEntries':
                await this.configurationStorage.setCurrentDataSourceId(command.dataSourceId);
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

const DEFAULT_CONFIGURATION: Pick<LogTableConfigurationParams, 'timezones' | 'timeRanges' | 'preambleProperties'> = {
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
