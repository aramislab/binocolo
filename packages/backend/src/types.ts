import { Static, Type } from '@sinclair/typebox';
import { TimeRange } from '@binocolo/common/types.js';
import {
    // DataSourceFilter,
    // JSONFieldSelector,
    // HistogramDataSeries,
    // RecordsScanningStats,
    DataSourceSpecs,
    DataSourceConfig,
    DataSourceQuery,
    NamedSearch,
} from '@binocolo/common/common.js';
// import { ElaboratedTimeRange } from '@binocolo/common/time.js';
import { SenderFunction } from './network.js';

// Documentation:
// - https://www.npmjs.com/package/@sinclair/typebox

export const InputLogEntrySchema = Type.Object({
    id: Type.String(),
    ts: Type.Number(),
    payload: Type.Any(),
});
export type InputLogEntry = Static<typeof InputLogEntrySchema>;

export type QueryDescriptor = {
    stop(): void;
};

type QueryLogsParams = {
    timeRange: TimeRange;
    sendMessage: SenderFunction;
    queries: DataSourceQuery[];
    // filters: DataSourceFilter[];
    // histogramBreakdownProperty: JSONFieldSelector | null;
    onStarted: (query: QueryDescriptor) => void;
    // onData: (events: InputLogEntry[]) => Promise<void>;
    // onHistogram: (params: { elaboratedTimeRange: ElaboratedTimeRange; histogram: HistogramDataSeries[] }) => Promise<void>;
};

export interface IDataSourceAdapter {
    specs: DataSourceSpecs;
    queryDataSource(params: QueryLogsParams): Promise<void>;
    defaultQuery: DataSourceConfig['initialQuery'];
}

export type DataSourceWithSavedSearches<DataSourceSpecification> = {
    spec: DataSourceSpecification;
    savedSearches: NamedSearch[];
};

export interface IDataSourceSpecificationsStorage<DataSourceSpecification> {
    getDataSources(): Promise<DataSourceWithSavedSearches<DataSourceSpecification>[]>;
    addDataSource(dataSourceSpec: DataSourceSpecification): Promise<void>;
    saveSearch(dataSourceId: string, search: NamedSearch): Promise<void>;
}
