import {
    CloudWatchLogsClient,
    GetQueryResultsCommand,
    StartQueryCommand,
    ResultField,
    QueryStatistics,
} from '@aws-sdk/client-cloudwatch-logs';
import { Logger } from '@binocolo/backend/logging';
import { InputLogEntry, IDataSourceAdapter, QueryDescriptor } from '@binocolo/backend/types.js';
import {
    DataSourceSpecs,
    DataSourceFilter,
    HistogramDataSeries,
    makeStringFromJSONFieldSelector,
    DataSourceConfig,
} from '@binocolo/common/common.js';
import { ElaboratedTimeRange, elaborateTimeRange } from '@binocolo/common/time.js';
import { HOUR, MIN, SEC, TimeRange } from '@binocolo/common/types.js';
import { SenderFunction } from '@binocolo/backend/network.js';
import { DataSourceQuery } from '@binocolo/common/common.js';
import { BuildHistogramQuery, FetchEntriesQuery } from '@binocolo/common/common.js';

const QUERY_RESULTS_LIMIT = 5000;
const DELAY_BETWEEN_API_CALLS_IN_MS = 500;

export type AWSCloudWatchDataSourceSpecification = {
    type: 'AWSCloudWatch';
    region: string;
    logGroupNames: string[];
};

type CloudwatchLogsAdapterParams = {
    region: string;
    logger: Logger;
    verbose?: boolean;
    logGroupNames: string[];
};

// Documentation: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html

type QueryDataSourceParams = {
    timeRange: TimeRange;
    sendMessage: SenderFunction;
    queries: DataSourceQuery[];
    onStarted: (query: QueryDescriptor) => void;
};

export class CloudwatchLogsAdapter implements IDataSourceAdapter {
    private client: CloudWatchLogsClient;
    private logger: Logger;
    private readonly verbose: boolean;
    private readonly logGroupNames: string[];
    public specs: DataSourceSpecs = {
        supportedFilters: [
            {
                type: 'match',
            },
            {
                type: 'exists',
                exists: true,
                considerNulls: true,
            },
            {
                type: 'exists',
                exists: false,
                considerNulls: true,
            },
        ],
        timestampPropertySelector: '@timestamp',
    };
    public defaultQuery: DataSourceConfig['initialQuery'] = {
        filters: [],
        shownProperties: ['severity', 'message'],
        timeRange: {
            type: 'relative',
            amount: 15,
            specifier: 'minutes',
        },
    };

    constructor({ region, logger, verbose, logGroupNames }: CloudwatchLogsAdapterParams) {
        this.logger = logger;
        this.verbose = !!verbose;
        this.client = new CloudWatchLogsClient({ region });
        this.logGroupNames = logGroupNames;
    }

    async queryDataSource(params: QueryDataSourceParams): Promise<void> {
        const querySet = new AWSCloudWatchQuerySet(params, this.logGroupNames, this.client, this.logger, this.verbose);
        await querySet.run();
    }
}

class AWSCloudWatchQuerySet {
    private queryDescriptors: QueryDescriptor[];
    private elaboratedTimeRange: ElaboratedTimeRange;
    constructor(
        private params: QueryDataSourceParams,
        private readonly logGroupNames: string[],
        private client: CloudWatchLogsClient,
        private logger: Logger,
        private readonly verbose: boolean
    ) {
        this.queryDescriptors = [];
        const { timeRange } = params;
        this.elaboratedTimeRange = elaborateTimeRange(timeRange, 1000);
        if (this.elaboratedTimeRange.bucketSpec.durationInMs < 1000) {
            throw new Error(`Bucket size too small (${this.elaboratedTimeRange.bucketSpec.durationInMs} ms). Should be at least 1 second.`);
        }
    }
    async run(): Promise<void> {
        const { timeRange, onStarted, queries, sendMessage } = this.params;
        const elaboratedTimeRange = elaborateTimeRange(timeRange, 1000);
        if (elaboratedTimeRange.bucketSpec.durationInMs < 1000) {
            throw new Error(`Bucket size too small (${elaboratedTimeRange.bucketSpec.durationInMs} ms). Should be at least 1 second.`);
        }

        let stopped: boolean = false;
        onStarted({
            stop: () => {
                if (!stopped) {
                    stopped = true;
                    for (let qd of this.queryDescriptors) {
                        qd.stop();
                    }
                }
            },
        });

        await Promise.all(
            queries.map((query) => {
                const queryType = query.type;
                switch (queryType) {
                    case 'fetchEntries':
                        return this._fetchEntries(query);
                    case 'buildHistogram':
                        return this._buildHistogram(query);
                    default:
                        const exhaustiveCheck: never = queryType;
                        throw new Error(`Unhandled queryType: ${exhaustiveCheck}`);
                }
            })
        );
    }

    private async _fetchEntries({ filters }: FetchEntriesQuery): Promise<void> {
        let state: { entries: InputLogEntry[] } = {
            entries: [],
        };
        // let totFromHistogram: number = 0;
        let totNumRecords: number = 0;

        let nextEventId: number = 1;
        let reportedEntries: Set<string> = new Set();
        const fields: string[] = [
            'toMillis(@timestamp) as @timestamp',
            'toMillis(@ingestionTime) as @ingestionTime',
            '@message',
            '@log',
            '@logStream',
            '@duration',
        ];
        const { stats } = await this._runCloudWatchLogsQuery({
            label: 'lines',
            onlyLastBatch: true,
            timeRange: this.elaboratedTimeRange.timeRange,
            logGroupNames: this.logGroupNames,
            query: new CloudWatchQueryBuilder()
                .fields(fields.join(', '))
                .filters(filters)
                .sort('@timestamp desc')
                .limit(QUERY_RESULTS_LIMIT)
                .generateQuery(),
            onStarted: (descriptor) => {
                this.queryDescriptors.push(descriptor);
            },
            onData: async ({ rows }) => {
                let entries: InputLogEntry[] = [];
                for (let row of rows) {
                    const { ptr, ts, payload } = parseResultRow(row);
                    if (ts < this.elaboratedTimeRange.timeRange.start || ts > this.elaboratedTimeRange.timeRange.end) {
                        throw new Error(
                            `Log event outside of time range: ${new Date(ts)}, ${new Date(
                                this.elaboratedTimeRange.timeRange.start
                            )}-${new Date(this.elaboratedTimeRange.timeRange.end)}. @ptr = ${ptr}`
                        );
                    }
                    if (!reportedEntries.has(ptr)) {
                        totNumRecords += 1;
                        reportedEntries.add(ptr);
                        entries.push({
                            id: `${nextEventId++}`,
                            ts,
                            payload,
                        });
                    }
                }
                if (entries.length > 0) {
                    state.entries = entries;
                }
            },
        });

        // Sanity checks
        if (stats) {
            // const complete: boolean = stats.numResults === stats.recordsMatched || false;
            // if (complete && totNumRecords !== totFromHistogram) {
            //     throw new Error(`totNumRecords: ${totNumRecords}, totFromHistogram: ${totFromHistogram}`);
            // }
            if (totNumRecords !== stats.numResults) {
                throw new Error(`totNumRecords mismatch: ${totNumRecords}, stats: ${stats.numResults}`);
            }
        }
        await this.params.sendMessage({ type: 'sendEntries', entries: state.entries, stats });
    }

    private async _buildHistogram({ filters, histogramBreakdownProperty }: BuildHistogramQuery): Promise<void> {
        let histogramFields: string[] = [
            `count(*) as numRecords by toMillis(bin(${makePeriodString(this.elaboratedTimeRange.bucketSpec.durationInMs)})) as bucket`,
        ];
        if (histogramBreakdownProperty) {
            histogramFields.push(`${makeStringFromJSONFieldSelector(histogramBreakdownProperty)} as property`);
        }
        await this._runCloudWatchLogsQuery({
            label: 'histogram',
            onlyLastBatch: false,
            timeRange: this.elaboratedTimeRange.timeRange,
            logGroupNames: this.logGroupNames,
            query: new CloudWatchQueryBuilder().stats(histogramFields.join(', ')).filters(filters).limit(10000).generateQuery(),
            onStarted: (descriptor) => {
                this.queryDescriptors.push(descriptor);
            },
            onData: async ({ rows }) => {
                let histogramMaps = new HistogramMaps();
                // totFromHistogram = 0;
                for (let row of rows) {
                    const { bucket, numRecords, property } = parseHistogramStatsRow(row);
                    // totFromHistogram += numRecords;
                    if (this.elaboratedTimeRange.timestamps.includes(bucket)) {
                        histogramMaps.addNumRecords(property, bucket, numRecords);
                    } else {
                        throw new Error(
                            `Bucket outside of timerange: ${new Date(bucket)}, time range: ${new Date(
                                this.elaboratedTimeRange.timeRange.start
                            )}-${new Date(this.elaboratedTimeRange.timeRange.end)}, bucket size: ${
                                this.elaboratedTimeRange.bucketSpec.durationInMs
                            }ms`
                        );
                    }
                }
                await this.params.sendMessage({
                    type: 'sendHistogram',
                    elaboratedTimeRange: this.elaboratedTimeRange,
                    histogram: histogramMaps.getDataSeries(this.elaboratedTimeRange.timestamps),
                });
            },
        });
    }

    private async _runCloudWatchLogsQuery({
        label,
        query,
        timeRange,
        onStarted,
        onlyLastBatch,
        onData,
        logGroupNames,
    }: {
        label: string;
        logGroupNames: string[];
        query: string;
        timeRange: TimeRange;
        onlyLastBatch: boolean;
        onStarted: (query: QueryDescriptor) => void;
        onData: (params: { rows: ResultField[][]; stats: QueryStatistics }) => Promise<void>;
    }): Promise<{ stats?: { recordsScanned: number; recordsMatched: number; numResults: number } }> {
        this.verbose &&
            this.logger.info(
                `${label}: Running CloudWatch Logs Insights query.\nTime range: ${new Date(timeRange.start)} - ${new Date(
                    timeRange.end
                )}\n${query}`
            );
        const { queryId } = await this.client.send(
            new StartQueryCommand({
                logGroupNames: logGroupNames,
                startTime: timeRange.start,
                endTime: timeRange.end,
                queryString: query,
            })
        );
        if (!queryId) {
            throw new Error('Unexpected empty queryId after starting CloudWatch Logs Insights query');
        }
        let kepGoing: boolean = true;
        const stop = () => {
            this.logger.info(`${label}: Interrupting query`);
            kepGoing = false;
        };
        onStarted({ stop });
        let sleepDelayInMs = DELAY_BETWEEN_API_CALLS_IN_MS;
        while (kepGoing) {
            this.verbose && this.logger.info(`${label}: Fetching results...`);
            let response = await this.client.send(new GetQueryResultsCommand({ queryId }));
            if (!response) {
                throw new Error('Unexpected empty response from GetQueryResultsCommand');
            }
            this.verbose &&
                this.logger.info(
                    `${label}: Response status: ${response.status}\nMetadata: ${JSON.stringify(
                        response.$metadata,
                        null,
                        2
                    )}\nStats: ${JSON.stringify(response.statistics, null, 2)}\nNum results: ${response.results?.length}`
                );

            if (response.status !== 'Complete' && response.status !== 'Scheduled' && response.status !== 'Running') {
                throw new Error(`Unexpected status "${response.status}" from GetQueryResultsCommand`);
            }
            if (response.results) {
                if (!response.statistics) {
                    throw new Error('Missing statistics');
                }
                if (!onlyLastBatch || response.status === 'Complete') {
                    await onData({ rows: response.results, stats: response.statistics });
                }
                sleepDelayInMs = DELAY_BETWEEN_API_CALLS_IN_MS; // Fetch data fast when it becomes available
            }
            if (response.status === 'Complete') {
                this.verbose && this.logger.info(`${label}: Query complete`);
                return {
                    stats:
                        response.statistics && response.results && response.statistics.recordsScanned && response.statistics.recordsMatched
                            ? {
                                  recordsScanned: response.statistics.recordsScanned,
                                  recordsMatched: response.statistics.recordsMatched,
                                  numResults: response.results.length,
                              }
                            : undefined,
                };
            }
            await sleepMs(sleepDelayInMs);
            sleepDelayInMs *= 1.5; // Exponential back off when data is not available yet
        }
        return {};
    }
}

type Timestamp = number;
type PropertyValue = string | null;
type BucketsMap = Map<Timestamp, number>;

class HistogramMaps {
    private mapsOfMaps: Map<PropertyValue, BucketsMap>;

    constructor() {
        this.mapsOfMaps = new Map();
    }

    addNumRecords(propertyValue: PropertyValue, ts: Timestamp, amount: number) {
        let bucketsMap: BucketsMap | undefined = this.mapsOfMaps.get(propertyValue);
        if (!bucketsMap) {
            bucketsMap = new Map();
            this.mapsOfMaps.set(propertyValue, bucketsMap);
        }
        bucketsMap.set(ts, (bucketsMap.get(ts) || 0) + amount);
    }

    getDataSeries(timestamps: number[]): HistogramDataSeries[] {
        return Array.from(this.mapsOfMaps.entries()).map(([propertyValue, bucketsMap]) => ({
            propertyValue,
            datapoints: timestamps.map((bucket) => bucketsMap.get(bucket) || null),
        }));
    }
}

function parseResultRow(row: ResultField[]): { ptr: string; ts: number; payload: any } {
    const values = parseGenericResultsRow(row);
    if (values['@message'] === undefined) {
        throw new Error('Cannot find message');
    }
    let payload: any;
    try {
        payload = JSON.parse(values['@message']);
    } catch (err) {
        payload = {
            message: values['@message'],
        };
    }
    let ts: number | undefined = undefined;
    if (values['@timestamp'] !== undefined) {
        ts = parseFloat(values['@timestamp']);
    } else if (values['@ingestionTime'] !== undefined) {
        ts = parseFloat(values['@ingestionTime']);
    }
    if (ts === undefined) {
        throw new Error('Cannot find a timestamp');
    }
    if (!values['@ptr']) {
        throw new Error('Cannot find @ptr');
    }
    // payload['@ptr'] = values['@ptr'];
    payload['@log'] = values['@log'];
    payload['@logStream'] = values['@logStream'];
    if (values['@duration'] !== undefined) {
        payload['@duration'] = parseFloat(values['@duration']);
    }
    return { ptr: values['@ptr'], ts, payload };
}

function parseHistogramStatsRow(row: ResultField[]): { bucket: number; numRecords: number; property: string | null } {
    const values = parseGenericResultsRow(row);
    if (values.bucket === undefined) {
        throw new Error('Missing bucket in row');
    }
    if (values.numRecords === undefined) {
        throw new Error('Missing numRecords in row');
    }
    return {
        bucket: parseFloat(values.bucket),
        numRecords: parseFloat(values.numRecords),
        property: values.property || null,
    };
}

function parseGenericResultsRow(row: ResultField[]): any {
    let result: any = {};
    for (let { field, value } of row) {
        if (field) {
            result[field] = value;
        } else {
            throw new Error(`Field with no "field" value`);
        }
    }
    return result;
}

class CloudWatchQueryBuilder {
    private lines: string[];

    constructor() {
        this.lines = [];
    }

    stats(stats: string): CloudWatchQueryBuilder {
        this.lines.push(`stats ${stats}`);
        return this;
    }

    fields(fields: string): CloudWatchQueryBuilder {
        this.lines.push(`fields ${fields}`);
        return this;
    }

    filters(filters: DataSourceFilter[]): CloudWatchQueryBuilder {
        console.log(filters);
        for (let filter of filters) {
            const filterType = filter.type;
            switch (filterType) {
                case 'match':
                    (() => {
                        const selectors = filter.selector.split('+');
                        if (selectors.length > 0 && filter.values.length > 0) {
                            const equalityOp = filter.exact ? (filter.include ? '=' : '!=') : filter.include ? 'like' : 'not like';
                            const booleanOp = filter.include ? ' or ' : ' and ';
                            let conditions: string[] = [];
                            for (let selector of selectors) {
                                for (let value of filter.values) {
                                    const valueLiteral =
                                        filter.exact || typeof value !== 'string' ? JSON.stringify(value) : `/(?i)${escapeRegExp(value)}/`;
                                    conditions.push(`${selector} ${equalityOp} ${valueLiteral}`);
                                }
                            }
                            const conditionText = conditions.join(booleanOp);
                            this.lines.push(`| filter ${conditionText}`);
                        }
                    })();
                    break;

                case 'exists':
                    (() => {
                        const selectors = filter.selector.split('+');
                        if (selectors.length > 0) {
                            if (!filter.considerNulls) {
                                throw new Error('"exists" filter, "considerNulls" not supported');
                            }
                            const operator = filter.exists ? 'ispresent' : 'not ispresent';
                            const booleanJoin = filter.exists ? ' or ' : ' and ';
                            const conditionText = selectors.map((selector) => `${operator}(${selector})`).join(booleanJoin);
                            this.lines.push(`| filter ${conditionText}`);
                        }
                    })();
                    break;

                default:
                    const exhaustiveCheck: never = filterType;
                    throw new Error(`Unhandled filter.type: ${exhaustiveCheck}`);
            }
        }
        return this;
    }
    sort(sort: string): CloudWatchQueryBuilder {
        this.lines.push(`| sort ${sort}`);
        return this;
    }
    limit(limit: number): CloudWatchQueryBuilder {
        this.lines.push(`| limit ${limit}`);
        return this;
    }
    generateQuery(): string {
        return this.lines.join('\n');
    }
}

// From: https://stackoverflow.com/a/9310752/225097
function escapeRegExp(value: string): string {
    return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function makePeriodString(durationMs: number): string {
    if (durationMs < SEC) {
        return `${durationMs}ms`;
    } else if (durationMs < MIN) {
        return `${divideAndAssertMultipleOf(durationMs, SEC)}s`;
    } else if (durationMs < HOUR) {
        return `${divideAndAssertMultipleOf(durationMs, MIN)}m`;
    } else {
        return `${divideAndAssertMultipleOf(durationMs, HOUR)}h`;
    }
}

function divideAndAssertMultipleOf(durationMs: number, roundTo: number): number {
    const value = Math.floor(durationMs / roundTo);
    if (value * roundTo !== durationMs) {
        throw new Error(`Duration of ${durationMs} ms is not a multiple of ${roundTo}`);
    }
    return value;
}

// function buildCloudWatchLogsQuery(filters: DataSourceFilter[], limit: number): string {
//     let lines: string[] = ['fields @timestamp, @ingestionTime, @message'];
//     for (let filter of filters) {
//         switch (filter.type) {
//             case 'match':
//                 (() => {
//                     const selector = makeStringFromJSONFieldSelector(filter.selector);
//                     const equalityOp = filter.include ? '=' : '!=';
//                     const booleanOp = filter.include ? ' or ' : ' and ';
//                     const conditionText = filter.values
//                         .map((value) => `${selector} ${equalityOp} ${JSON.stringify(value)}`)
//                         .join(booleanOp);
//                     lines.push(`| filter ${conditionText}`);
//                 })();
//                 break;
//
//             case 'exists':
//                 (() => {
//                     const selector = makeStringFromJSONFieldSelector(filter.selector);
//                     if (filter.exists) {
//                         if (filter.considerNulls) {
//                             lines.push(`| filter ispresent(${selector})`);
//                         } else {
//                             // not implemented, because not possible
//                         }
//                     } else {
//                         if (filter.considerNulls) {
//                             lines.push(`| filter not ispresent(${selector})`);
//                         } else {
//                             // not implemented, because not possible
//                         }
//                     }
//                 })();
//                 break;
//
//             default:
//                 const exhaustiveCheck: never = filter;
//                 throw new Error(`Unhandled filter.type: ${exhaustiveCheck}`);
//         }
//     }
//     lines.push(`| sort @timestamp desc`);
//     lines.push(`| limit ${limit}`);
//     return lines.join('\n');
// }

const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
