import { ElaboratedTimeRange } from './time.js';
import { TimeRange, MIN, HOUR, DAY } from './types.js';
import deepEqual from 'deep-equal';

export type InputLogEntry = {
    id: string;
    ts: number;
    payload: any;
};

export type HistogramDataSeries = {
    propertyValue: string | null;
    datapoints: (number | null)[];
};

// ---- Command for Backend ------------------------------------

export type FetchEntriesCommand = {
    type: 'fetchEntries';
    dataSourceId: string;
    timeRange: TimeRange;
    filters: DataSourceFilter[];
    histogramBreakdownProperty: JSONFieldSelector | null;
};

export type StopQueryCommand = {
    type: 'stopQuery';
};

export type BackendCommand = FetchEntriesCommand | StopQueryCommand;

export function parseBackendCommand(data: any): BackendCommand {
    // TODO: implement Schema checking
    return data as BackendCommand;
}

// ---- Commands for Client ------------------------------------

export type SendEntriesCommand = {
    type: 'sendEntries';
    entries: InputLogEntry[];
};

export type SendHistogramCommand = {
    type: 'sendHistogram';
    elaboratedTimeRange: ElaboratedTimeRange;
    histogram: HistogramDataSeries[];
};

export type RecordsScanningStats = {
    recordsMatched: number;
    recordsScanned: number;
    numResults: number;
};

export type DoneLoadingEntriesCommand = {
    type: 'doneLoadingEntries';
    stats?: RecordsScanningStats;
    errorMessage?: string;
};

export type ConfigurationCommand = {
    type: 'configuration';
    params: LogTableConfigurationParams;
};

export type ClientCommand = SendEntriesCommand | DoneLoadingEntriesCommand | ConfigurationCommand | SendHistogramCommand;

export function parseClientCommand(data: any): ClientCommand {
    // TODO: implement Schema checking
    return data as ClientCommand;
}

// -- JSON --------------------

export type JSONBasicTypeName = 'string' | 'number' | 'boolean' | 'null';

export type JSONBasicType = string | number | boolean | null;

export type JSONType = JSONBasicType | JSONType[] | { [key: string]: JSONType };

export function isJSONBasicType(value: any): value is JSONBasicType {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
}

export type JSONFieldSelector = JSONFieldSelectorPart[];

export type JSONFieldSelectorPart = JSONFieldSelectorRoot | JSONFieldSelectorCompound | JSONFieldSelectorProperty | JSONFieldSelectorItem;

export type JSONFieldSelectorRoot = {
    type: 'root';
};

export type JSONFieldSelectorCompound = {
    type: 'compound';
    selectors: JSONFieldSelector[];
};

export type JSONFieldSelectorProperty = {
    type: 'property';
    name: string;
};

export type JSONFieldSelectorItem = {
    type: 'item';
    index: number;
};

export function makeStringFromJSONFieldSelector(selector: JSONFieldSelector): string {
    let parts: string[] = [];
    for (let part of selector) {
        switch (part.type) {
            case 'root':
                parts = [];
                break;
            case 'compound':
                parts = [part.selectors.map(makeStringFromJSONFieldSelector).join('+')];
                break;
            case 'property':
                const dot = parts.length > 0 ? '.' : '';
                parts.push(`${dot}${part.name}`);
                break;
            case 'item':
                parts.push(`[${part.index}]`);
                break;
            default:
                const exhaustiveCheck: never = part;
                throw new Error(`Unhandled part.type: ${exhaustiveCheck}`);
        }
    }
    return parts.join('');
}

export function parseFieldSelectorText(text: string): JSONFieldSelector {
    // Compound
    if (text.includes('+')) {
        return [
            {
                type: 'compound',
                selectors: text.split('+').map(parseFieldSelectorText),
            },
        ];
    }
    // Regular selector
    let result: JSONFieldSelector = [{ type: 'root' }];
    for (let part of text.split('.')) {
        if (part[0] === '[') {
            const idx = part.indexOf(']');
            const index = parseInt(part.slice(1, idx + 1));
            result.push({ type: 'item', index });
            part = part.slice(idx + 1);
        }
        result.push({ type: 'property', name: part });
    }
    return result;
}

// ---- Configuration ------------------------------------

export type LogTableConfigurationParams = {
    dataSourceSets: {
        id: string;
        name: string;
        dataSources: DataSourceConfig[];
    }[];
    initialDataSourceId: string;
    preambleProperties: string[];
    timezones: {
        timezones: TimezoneConfig[];
        defaultTimezone: string;
    };
    timeRanges: TimeRangesSpecs;
};

export type DataSourceConfig = {
    id: string;
    name: string;
    knownProperties: PropertyConfiguration[];
    supportedFilters: PartialDataSourceFilter[];
    timestampPropertySelector: string;
    initialQuery: {
        timeRange: TimeRangeSpecification;
        shownProperties: string[];
        filters: DataSourceFilter[];
    };
};

export type DataSourceSpecs = Pick<DataSourceConfig, 'supportedFilters' | 'timestampPropertySelector'>;

export type TimeRangeSpecification = RelativeTimeRangeSpecification;

export type RelativeTimeRangeSpecification = {
    type: 'relative';
    amount: number;
    specifier: TimeRangeSpecifierIds;
};

export type HighlightLevel = 'error' | 'warning' | 'normal';

export type PropertyConfiguration = {
    selector: string;
    name?: string;
    width?: number;
    grow?: boolean;
    timestamp?: boolean;
    distinctColorsForValues?: boolean;
    knownValues?: {
        value: JSONBasicType;
        color?: HighlightLevel;
    }[];
};

// -- Time Range --------------------

export type TimeRangeSpecifierIds = 'months' | 'weeks' | 'days' | 'hours' | 'minutes';

export const TIME_RANGE_SPECIFIERS: { name: string; kind: TimeRangeSpecifierIds; durationInMs: number }[] = [
    {
        name: 'Minutes',
        kind: 'minutes',
        durationInMs: MIN,
    },
    {
        name: 'Hours',
        kind: 'hours',
        durationInMs: HOUR,
    },
    {
        name: 'Days',
        kind: 'days',
        durationInMs: DAY,
    },
    {
        name: 'Weeks',
        kind: 'weeks',
        durationInMs: DAY * 7,
    },
    {
        name: 'Months',
        kind: 'months',
        durationInMs: DAY * 30,
    },
];

export type TimeRangesSpecs = { [k in TimeRangeSpecifierIds]: number[] };

export type TimezoneConfig = {
    id: string;
    description: string;
    timezone: string;
};

// ---- Filters ------------------------------------

export type DataSourceFilterType = 'match' | 'exists';

export interface MatchDataSourceFilter {
    type: 'match';
    include: boolean;
    selector: string;
    values: JSONBasicType[];
}

export interface ExistsDataSourceFilter {
    type: 'exists';
    exists: boolean;
    considerNulls: boolean;
    selector: string;
}

export type DataSourceFilter = MatchDataSourceFilter | ExistsDataSourceFilter;

export type PartialDataSourceFilter = Partial<DataSourceFilter> & Pick<DataSourceFilter, 'type'>;

export function filterMatchesSpec(filter: DataSourceFilter, spec: Partial<DataSourceFilter>): boolean {
    for (let key of Object.keys(spec)) {
        if (!deepEqual((filter as any)[key], (spec as any)[key], { strict: true })) {
            return false;
        }
    }
    return true;
}
