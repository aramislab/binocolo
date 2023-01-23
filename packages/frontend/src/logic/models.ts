import { action, makeObservable, observable } from 'mobx';
import {
    InputLogEntry,
    BackendCommand,
    ClientCommand,
    LogTableConfigurationParams,
    PropertyConfiguration,
    TimezoneConfig,
    TimeRangesSpecs,
    JSONFieldSelector,
    makeStringFromJSONFieldSelector,
    DataSourceFilter,
    PartialDataSourceFilter,
    filterMatchesSpec,
    JSONBasicType,
    JSONType,
    RecordsScanningStats,
    HistogramDataSeries,
    parseFieldSelectorText,
    ExistsDataSourceFilter,
    DataSourceConfig,
} from '@binocolo/common/common.js';
import { TimeRange } from '@binocolo/common/types';
import {
    elaborateTimeRange,
    aggregateByTimestamp,
    ElaboratedTimeRange,
    TimeBucketsAggregator,
    timestampInRange,
} from '@binocolo/common/time.js';
import {
    ProcessedLogEntry,
    PropertyData,
    FIRST_ATTRIBUTE_COL_NUM,
    FIXED_COLUMNS_WIDTHS,
    TimeFormat,
    PropertyNode,
    LogCellData,
    notNullNumber,
    notEmpty,
} from './types.js';
import { formatDateInTimeZone } from './time.js';
import { ColorTheme, DEFAULT_COLOR_THEME } from './themes.js';
import { filterMatches, makeFilterId } from './filters.js';
import { calculatePropertyNodeSize, inspectPayload, makeEmptyPropertyNode, visitPayload } from './inspect_payload.js';
import { FrequencyStats, mergeFrequencyStats, PropertyValueStatsCalculator } from './value_frequencies.js';
import { getTimeRangeFromSpecification } from '@binocolo/common/time.js';

const MIN_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 180;

export const TABLE_PADDING = 10;
export const TABLE_COLUMNS_GAP = 10;

export type SendMessageFunction = (message: BackendCommand) => void;

export interface IApplicationState {
    config: LogTableConfiguration | null;
    terminated: boolean;
}

const EMPTY_PROPERTY_NODE_ROOT = (): PropertyNode => makeEmptyPropertyNode([{ type: 'root' }]);

const TIMESTAMP_FORMAT = 'yyyy-MM-dd HH:mm:ss.SSS';

export type HistogramData = {
    labels: string[];
    timestamps: number[];
    datasets: HistogramSeriesData[];
};

export type HistogramSeriesData = {
    title: string;
    color: string;
    dimmed: boolean;
    buckets: (number | null)[];
};

export class LogTableConfiguration {
    private preambleProperties: string[];
    public shownProperties: JSONFieldSelector[];
    public zoom: number;
    public multiline: boolean;
    public nullVisible: boolean;
    public histogramBreakdownProperty: JSONFieldSelector | null;

    public shownPropertiesSet: Set<string>;
    private preamblePropertiesSet: Set<string>;
    public propertiesData: PropertyData[];

    private supportedDataSourceFilters: PartialDataSourceFilter[];
    public visualizationFilters: DataSourceFilter[];
    public dataSourceFilters: DataSourceFilter[];

    private entriesStorage: LogEntriesStorage;
    public entriesSelection: LogEntriesSelection;
    public numInputEntries: number;

    public gridTemplateColumns: string | undefined;
    private fillerColumn: boolean;
    private totalWidth: number | null;
    private sendMessage: SendMessageFunction;

    public loading: boolean;
    public serverError: string | null;
    public dataBundleStats: RecordsScanningStats | null;

    public timeRanges: TimeRangesSpecs;

    private timestampFieldSelector: JSONFieldSelector;

    private timezonesMap: Map<string, TimezoneConfig>;
    public timezoneId: string;
    private timeFormat: TimeFormat;
    public timezones: TimezoneConfig[];

    private dataSourceTimeRange: TimeRange;
    public elaboratedTimeRange: ElaboratedTimeRange;
    public histogram: HistogramDataSeries[] | null;
    public dataSourceSets: LogTableConfigurationParams['dataSourceSets'];

    public colorTheme: ColorTheme;

    private dataSourcesMap: Map<string, DataSourceConfig>;
    public currentDataSourceId: string;

    constructor(params: LogTableConfigurationParams, sendMessage: SendMessageFunction) {
        this.colorTheme = DEFAULT_COLOR_THEME;
        this.timeRanges = params.timeRanges;
        this.preambleProperties = params.preambleProperties;
        this.dataSourceSets = params.dataSourceSets;

        this.dataSourcesMap = new Map();
        for (let set of this.dataSourceSets) {
            for (let dataSource of set.dataSources) {
                this.dataSourcesMap.set(dataSource.id, dataSource);
            }
        }
        this.currentDataSourceId = params.initialDataSourceId;

        this.supportedDataSourceFilters = this.getCurrentDataSource().supportedFilters;

        // this.preambleProperties = this.getCurrentDataSource().preambleProperties.map(parseFieldSelectorText);
        this.shownProperties = this.getCurrentDataSource().initialQuery.shownProperties.map(parseFieldSelectorText);
        this.timestampFieldSelector = parseFieldSelectorText(this.getCurrentDataSource().timestampPropertySelector);
        this.timeFormat = {
            timestampFormat: TIMESTAMP_FORMAT,
        };
        this.timezones = params.timezones.timezones;
        this.timezonesMap = new Map();
        for (let timezone of params.timezones.timezones) {
            this.timezonesMap.set(timezone.id, timezone);
        }
        this.timezoneId = params.timezones.defaultTimezone;

        this.zoom = 1;
        this.multiline = false;
        this.nullVisible = false;

        this.preamblePropertiesSet = new Set();
        this.shownPropertiesSet = new Set();
        this.propertiesData = [];
        this.histogramBreakdownProperty = null;

        this.fillerColumn = false;
        this.gridTemplateColumns = undefined;
        this.totalWidth = null;

        this.loading = false;
        this.serverError = null;
        this.dataBundleStats = null;

        this.elaboratedTimeRange = elaborateTimeRange(getTimeRangeFromSpecification(this.getCurrentDataSource().initialQuery.timeRange));
        this.dataSourceTimeRange = this.elaboratedTimeRange.timeRange;
        this.histogram = null;

        this.updatePropertiesMap();
        this.computePropertiesData();
        this.computeColumns();

        this.visualizationFilters = [];
        this.dataSourceFilters = this.getCurrentDataSource().initialQuery.filters;
        this.entriesStorage = new LogEntriesStorage();
        this.entriesSelection = new LogEntriesSelection(this.entryMatchesFilters.bind(this), null, this.getKnownPropertiesMap());
        this.numInputEntries = 0;

        this.sendMessage = sendMessage;

        makeObservable(this, {
            // preambleProperties: observable.deep,
            shownProperties: observable.deep,
            zoom: observable,
            multiline: observable,
            nullVisible: observable,
            propertiesData: observable,
            gridTemplateColumns: observable,
            numInputEntries: observable,
            loading: observable,
            serverError: observable,
            dataBundleStats: observable.deep,
            timezoneId: observable,
            elaboratedTimeRange: observable.deep,
            histogram: observable.deep,
            colorTheme: observable,
            visualizationFilters: observable,
            dataSourceFilters: observable,
            entriesSelection: observable,
            histogramBreakdownProperty: observable,
            shownPropertiesSet: observable.deep,
            currentDataSourceId: observable,

            toggleNullVisible: action,
            togglePropertyVisibility: action,
            setZoom: action,
            toggleMultiline: action,
            addFilter: action,
            removeFilter: action,
            changeOrAddFilter: action,
            setTableWidth: action,
            loadEntriesFromDataSource: action,
            changeDataSourceConfiguration: action,
            onWebsocketMessage: action,
            setTimezoneId: action,
            changeTimeRange: action,
            stopQuery: action,
            setHistogramBreakdownProperty: action,
            changeDataSource: action,
        });
    }

    public changeDataSource(dataSourceId: string): void {
        this.currentDataSourceId = dataSourceId;
        this.supportedDataSourceFilters = this.getCurrentDataSource().supportedFilters;
        this.shownProperties = this.getCurrentDataSource().initialQuery.shownProperties.map(parseFieldSelectorText);
        this.timestampFieldSelector = parseFieldSelectorText(this.getCurrentDataSource().timestampPropertySelector);
        this.elaboratedTimeRange = elaborateTimeRange(getTimeRangeFromSpecification(this.getCurrentDataSource().initialQuery.timeRange));
        this.dataSourceTimeRange = this.elaboratedTimeRange.timeRange;
        this.histogram = null;

        this.updatePropertiesMap();
        this.computePropertiesData();
        this.computeColumns();

        this.visualizationFilters = [];
        this.dataSourceFilters = this.getCurrentDataSource().initialQuery.filters;
        this.entriesStorage = new LogEntriesStorage();
        this.entriesSelection = new LogEntriesSelection(this.entryMatchesFilters.bind(this), null, this.getKnownPropertiesMap());
        this.numInputEntries = 0;

        this.loadEntriesFromDataSource();
    }

    private getKnownPropertiesMap(): Map<string, PropertyConfiguration> {
        const map: Map<string, PropertyConfiguration> = new Map();
        for (let propertyConfig of this.getCurrentDataSource().knownProperties) {
            map.set(propertyConfig.selector, propertyConfig);
        }
        return map;
    }

    private getCurrentDataSource(): DataSourceConfig {
        const dataSource = this.dataSourcesMap.get(this.currentDataSourceId);
        if (!dataSource) {
            throw new Error(`Cannot find data source with ID ${this.currentDataSourceId}`);
        }
        return dataSource;
    }

    public setHistogramBreakdownProperty(property: JSONFieldSelector | null): void {
        this.histogramBreakdownProperty = property;
        this.loadEntriesFromDataSource();
    }

    public resultsComplete(): boolean {
        return (this.dataBundleStats && this.dataBundleStats.recordsMatched === this.dataBundleStats.numResults) || false;
    }

    private recomputeEntriesSelection(): void {
        this.entriesSelection = new LogEntriesSelection(
            this.entryMatchesFilters.bind(this),
            this.resultsComplete()
                ? {
                      timeRange: this.elaboratedTimeRange.timeRange,
                      bucketSizeInMs: this.elaboratedTimeRange.bucketSpec.durationInMs,
                  }
                : null,
            this.getKnownPropertiesMap()
        );
        this.entriesSelection.filterEntries(this.entriesStorage.entries);
        if (this.resultsComplete()) {
            this.histogram = this.entriesSelection.getHistogram();
        }
    }

    public toggleNullVisible(): void {
        this.nullVisible = !this.nullVisible;
    }

    public timeRangeEdited(): boolean {
        return (
            this.dataSourceTimeRange.start !== this.elaboratedTimeRange.timeRange.start ||
            this.dataSourceTimeRange.end !== this.elaboratedTimeRange.timeRange.end
        );
    }

    restoreTimeRange(): void {
        this.changeTimeRange(this.dataSourceTimeRange);
    }

    setTimezoneId(id: string): void {
        this.timezoneId = id;
        this.computePropertiesData();
    }

    public getTimezoneInfo(): TimezoneConfig {
        const tz = this.timezonesMap.get(this.timezoneId);
        if (!tz) {
            throw new Error(`Unknown timezone ID "${this.timezoneId}"`);
        }
        return tz;
    }

    private getTimezoneString(): string {
        return this.getTimezoneInfo().timezone;
    }

    public getTimeRangeData() {
        const timezone = this.getTimezoneString();
        return {
            startText: formatDateInTimeZone(new Date(this.elaboratedTimeRange.timeRange.start), timezone, this.timeFormat.timestampFormat),
            endText: formatDateInTimeZone(new Date(this.elaboratedTimeRange.timeRange.end), timezone, this.timeFormat.timestampFormat),
            bucketSize: this.elaboratedTimeRange.bucketSpec.name,
        };
    }

    public onWebsocketMessage(message: ClientCommand): void {
        switch (message.type) {
            case 'sendEntries':
                this.entriesStorage.addEntriesBlock(message.entries);
                this.numInputEntries += message.entries.length;
                this.dataBundleStats = message.stats || null;
                this.recomputeEntriesSelection();
                break;
            case 'doneLoadingEntries':
                this.loading = false;
                this.serverError = message.errorMessage || null;
                break;
            case 'configuration':
                throw new Error(`Configuration message is not supposed to be seen here`);
            case 'sendHistogram':
                this.dataSourceTimeRange = message.elaboratedTimeRange.timeRange;
                this.elaboratedTimeRange = message.elaboratedTimeRange;
                this.histogram = message.histogram;
                break;
            default:
                const exhaustiveCheck: never = message;
                throw new Error(`Unhandled message.type: ${exhaustiveCheck}`);
        }
    }

    changeDataSourceConfiguration(timeRange: TimeRange): void {
        this.dataSourceTimeRange = timeRange;
        this.elaboratedTimeRange = elaborateTimeRange(this.dataSourceTimeRange);
        this.loadEntriesFromDataSource();
    }

    stopQuery(): void {
        this.loading = true;
        this.dataBundleStats = null;
        this.sendMessage({
            type: 'stopQuery',
        });
    }

    loadEntriesFromDataSource(): void {
        this.entriesStorage = new LogEntriesStorage();
        this.entriesSelection = new LogEntriesSelection(this.entryMatchesFilters.bind(this), null, this.getKnownPropertiesMap());
        this.numInputEntries = 0;
        this.histogram = null;
        this.dataSourceFilters = this.dataSourceFilters.concat(this.visualizationFilters);
        this.visualizationFilters = [];
        this.loading = true;
        this.dataBundleStats = null;
        this.sendMessage({
            type: 'queryDataSource',
            dataSourceId: this.currentDataSourceId,
            timeRange: this.dataSourceTimeRange,
            queries: [
                {
                    type: 'fetchEntries',
                    filters: this.dataSourceFilters,
                },
                {
                    type: 'buildHistogram',
                    filters: this.dataSourceFilters,
                    histogramBreakdownProperty: this.histogramBreakdownProperty,
                },
            ],
        });
    }

    changeTimeRange(timeRange: TimeRange): void {
        if (this.resultsComplete()) {
            this.elaboratedTimeRange = elaborateTimeRange(timeRange);
            this.recomputeEntriesSelection();
        } else {
            this.dataSourceTimeRange = timeRange;
            this.elaboratedTimeRange = elaborateTimeRange(this.dataSourceTimeRange);
            this.loadEntriesFromDataSource();
        }
    }

    buildHistogramData(): HistogramData {
        const MAX_NUM_DATASETS = 10;
        const format = (ts: number) => formatDateInTimeZone(ts, this.getTimezoneString(), this.elaboratedTimeRange.bucketSpec.format);
        let datasets: HistogramSeriesData[] = [];
        if (this.histogram) {
            const datasetsWithTotals = this.histogram.map(({ propertyValue, datapoints }) => ({
                propertyValue,
                datapoints,
                total: datapoints.filter(notNullNumber).reduce(sum, 0),
                dimmed: propertyValue === null,
            }));
            datasetsWithTotals.sort((a, b) => (a.total < b.total ? 1 : a.total > b.total ? -1 : 0));
            let datasetsToPlot =
                datasetsWithTotals.length > MAX_NUM_DATASETS ? datasetsWithTotals.slice(0, MAX_NUM_DATASETS) : datasetsWithTotals;
            if (datasetsWithTotals.length > MAX_NUM_DATASETS) {
                let datapoints: (number | null)[] = [];
                for (let idx = 0; idx < this.elaboratedTimeRange.timestamps.length; idx += 1) {
                    datapoints.push(null);
                }
                for (let dataset of datasetsWithTotals.slice(MAX_NUM_DATASETS)) {
                    for (let idx = 0; idx < this.elaboratedTimeRange.timestamps.length; idx += 1) {
                        const value = dataset.datapoints[idx];
                        if (value !== null) {
                            const prevValue = datapoints[idx];
                            datapoints[idx] = (prevValue !== null ? prevValue : 0) + value;
                        }
                    }
                }
                // datasetsToPlot.push({
                //     datapoints,
                //     total: 0,
                //     propertyValue: '<other>',
                //     dimmed: true,
                // });
            }
            for (let idx = 0; idx < datasetsToPlot.length; idx += 1) {
                const dataset = datasetsToPlot[idx];
                datasets.push({
                    title: this.histogram.length === 1 ? 'Log Lines' : dataset.propertyValue === null ? '<null>' : dataset.propertyValue,
                    color: this.histogram.length === 1 ? this.colorTheme.datasets.normal : this.colorTheme.datasets.other[idx],
                    buckets: dataset.datapoints,
                    dimmed: dataset.dimmed,
                });
            }
        }
        return {
            labels: this.elaboratedTimeRange.timestamps.map(format),
            timestamps: this.elaboratedTimeRange.timestamps,
            datasets,
        };
    }

    private updatePropertiesMap() {
        const preambleProperties = this.preambleProperties;
        this.preamblePropertiesSet = new Set();
        for (let property of preambleProperties) {
            this.preamblePropertiesSet.add(property);
        }
        this.shownPropertiesSet = new Set();
        for (let property of this.shownProperties) {
            this.shownPropertiesSet.add(makeStringFromJSONFieldSelector(property));
        }
    }

    private computePropertiesData(): void {
        const preambleProperties = this.preambleProperties.map(parseFieldSelectorText);
        this.propertiesData = [];
        let properties: { selector: JSONFieldSelector; tonedDown: boolean }[] = [];
        for (let selector of preambleProperties) {
            properties.push({ selector, tonedDown: true });
        }
        for (let selector of this.shownProperties) {
            properties.push({ selector, tonedDown: false });
        }
        const knownPropertiesMap = this.getKnownPropertiesMap();
        properties.forEach(({ selector, tonedDown }, idx) => {
            const propertyConfig = knownPropertiesMap.get(makeStringFromJSONFieldSelector(selector));
            this.propertiesData.push({
                selector,
                name:
                    ((propertyConfig && propertyConfig.name) || makeStringFromJSONFieldSelector(selector)) +
                    (propertyConfig && propertyConfig.timestamp ? ` (${this.timezoneId})` : ''),
                tonedDown,
                column: FIRST_ATTRIBUTE_COL_NUM + idx,
                processor: propertyConfig && propertyConfig.timestamp ? 'timestamp' : 'normal',
                getColor: (value) => {
                    if (propertyConfig && propertyConfig.distinctColorsForValues) {
                        let total: number = 0;
                        const valueString = `${value}`;
                        for (let idx = 0; idx < valueString.length; idx += 1) {
                            total += valueString.charCodeAt(idx);
                        }
                        return this.colorTheme.dark.distinctColors[total % this.colorTheme.dark.distinctColors.length];
                    }
                    if (propertyConfig && propertyConfig.knownValues) {
                        for (let knownValue of propertyConfig.knownValues) {
                            if (knownValue.color && value === knownValue.value) {
                                return this.colorTheme.dark.highlightLevels[knownValue.color];
                            }
                        }
                    }
                    return null;
                },
            });
        });
    }

    canToggleVisibility(selector: JSONFieldSelector): boolean {
        return !this.preamblePropertiesSet.has(makeStringFromJSONFieldSelector(selector));
    }

    isPropertyShown(selector: JSONFieldSelector): boolean {
        return (
            this.preamblePropertiesSet.has(makeStringFromJSONFieldSelector(selector)) ||
            this.shownPropertiesSet.has(makeStringFromJSONFieldSelector(selector))
        );
    }

    togglePropertyVisibility(selector: JSONFieldSelector): void {
        if (!this.isPropertyShown(selector)) {
            this.shownProperties.push(selector);
        } else {
            this.shownProperties = this.shownProperties.filter(
                (_selector) => makeStringFromJSONFieldSelector(_selector) !== makeStringFromJSONFieldSelector(selector)
            );
        }
        this.updatePropertiesMap();
        this.computePropertiesData();
        this.computeColumns();
    }

    setTableWidth(width: number): void {
        this.totalWidth = width;
        this.computeColumns();
    }

    private computeColumns(): void {
        const preambleProperties = this.preambleProperties.map(parseFieldSelectorText);
        let widths: (number | null)[] = [...FIXED_COLUMNS_WIDTHS];
        const selectors = preambleProperties.concat(this.shownProperties);
        const knownPropertiesMap = this.getKnownPropertiesMap();
        for (let selector of selectors) {
            const propertyConfig = knownPropertiesMap.get(makeStringFromJSONFieldSelector(selector));
            let width: number | null = null;
            if (propertyConfig && propertyConfig.width) {
                width = propertyConfig.width * this.zoom;
            }
            const grow: boolean = (propertyConfig && propertyConfig.grow) || false;
            if (!width && !grow) {
                width = DEFAULT_COLUMN_WIDTH * this.zoom;
            }
            widths.push(width);
        }
        let totalSpecified = (widths.filter((w) => w !== null) as number[]).reduce((a, b) => a + b, 0);
        let numUnspecified = widths.filter((w) => w === null).length;
        if (this.totalWidth !== null) {
            const leftoverWidth =
                this.totalWidth - TABLE_PADDING * 2 - TABLE_COLUMNS_GAP * (widths.length - 1) * this.zoom - totalSpecified;
            const widthOfUnspecifiedColumn = Math.max(leftoverWidth / numUnspecified, MIN_COLUMN_WIDTH);
            let columnWidths = widths.map((w) => (w !== null ? w : widthOfUnspecifiedColumn));
            let columnSpecs: string[] = columnWidths.map((width) => `${width}px`);
            this.fillerColumn = numUnspecified === 0 && totalSpecified < this.totalWidth;
            if (this.fillerColumn) {
                columnSpecs.push('auto');
            }
            this.gridTemplateColumns = columnSpecs.join(' ');
        } else {
            this.gridTemplateColumns = undefined;
            this.fillerColumn = false;
        }
    }

    setZoom(value: number): void {
        this.zoom = value;
    }

    toggleMultiline(): void {
        this.multiline = !this.multiline;
    }

    addFilter(filter: DataSourceFilter): void {
        if (this.resultsComplete()) {
            this.visualizationFilters.push(filter);
            this.recomputeEntriesSelection();
        } else {
            this.dataSourceFilters.push(filter);
            this.loadEntriesFromDataSource();
        }
    }

    removeFilter(filterId: string): void {
        const fromDataSource = this._removeFilter(filterId);
        if (fromDataSource) {
            this.loadEntriesFromDataSource();
        } else {
            this.recomputeEntriesSelection();
        }
    }

    private _removeFilter(filterId: string): boolean {
        let fromDataSource: boolean = false;
        this.dataSourceFilters = this.dataSourceFilters.filter((filter) => {
            const match = makeFilterId(filter) === filterId;
            if (match) {
                fromDataSource = true;
            }
            return !match;
        });
        this.visualizationFilters = this.visualizationFilters.filter((filter) => makeFilterId(filter) !== filterId);
        return fromDataSource;
    }

    changeOrAddFilter(spec: PartialDataSourceFilter, filter: DataSourceFilter): void {
        const searchResult = this.searchFilter(spec);
        if (searchResult) {
            const filtersList = searchResult.fromDataSource ? this.dataSourceFilters : this.visualizationFilters;
            filtersList[searchResult.idx] = filter;
            if (searchResult.fromDataSource) {
                this.loadEntriesFromDataSource();
            } else {
                this.recomputeEntriesSelection();
            }
        } else {
            this.addFilter(filter);
        }
    }

    isFilterSupportedByDataSource(filter: DataSourceFilter): boolean {
        for (let spec of this.supportedDataSourceFilters) {
            if (filterMatchesSpec(filter, spec)) {
                return true;
            }
        }
        return false;
    }

    // getRelevantFiltersOnDataSource(spec: Partial<DataSourceFilter>): DataSourceFilter[] {
    //     return this.dataSourceFilters.filter((filter) => filterMatchesSpec(filter, spec));
    // }

    getExistenceFilters(selector: JSONFieldSelector): { title: string; onClick: () => void; condition: boolean }[] {
        const existenceFilter = this.searchFilter<ExistsDataSourceFilter>({
            type: 'exists',
            selector: makeStringFromJSONFieldSelector(selector),
        });
        const selectorText = makeStringFromJSONFieldSelector(selector);
        const spec: PartialDataSourceFilter = { type: 'exists', selector: selectorText };
        return [
            {
                title: 'Show all',
                condition: !existenceFilter || false,
                onClick: () => {
                    existenceFilter && this.removeFilter(makeFilterId(existenceFilter.filter));
                },
            },
            this.isFilterSupportedByDataSource({ type: 'exists', exists: true, considerNulls: false, selector: selectorText })
                ? {
                      title: 'Show only existing',
                      onClick: () => {
                          this.changeOrAddFilter(spec, { type: 'exists', exists: true, considerNulls: false, selector: selectorText });
                      },
                      condition: (existenceFilter && existenceFilter.filter.exists && !existenceFilter.filter.considerNulls) || false,
                  }
                : null,
            this.isFilterSupportedByDataSource({ type: 'exists', exists: true, considerNulls: true, selector: selectorText })
                ? {
                      title: 'Show only existing and not null',
                      onClick: () => {
                          this.changeOrAddFilter(spec, { type: 'exists', exists: true, considerNulls: true, selector: selectorText });
                      },
                      condition: (existenceFilter && existenceFilter.filter.exists && existenceFilter.filter.considerNulls) || false,
                  }
                : null,
            this.isFilterSupportedByDataSource({ type: 'exists', exists: false, considerNulls: false, selector: selectorText })
                ? {
                      title: 'Show only missing',
                      onClick: () => {
                          this.changeOrAddFilter(spec, { type: 'exists', exists: false, considerNulls: false, selector: selectorText });
                      },
                      condition: (existenceFilter && !existenceFilter.filter.exists && !existenceFilter.filter.considerNulls) || false,
                  }
                : null,
            this.isFilterSupportedByDataSource({ type: 'exists', exists: false, considerNulls: true, selector: selectorText })
                ? {
                      title: 'Show only missing or null',
                      onClick: () => {
                          this.changeOrAddFilter(spec, { type: 'exists', exists: false, considerNulls: true, selector: selectorText });
                      },
                      condition: (existenceFilter && !existenceFilter.filter.exists && existenceFilter.filter.considerNulls) || false,
                  }
                : null,
        ].filter(notEmpty);
    }

    searchFilter<Filter extends DataSourceFilter>(
        spec: PartialDataSourceFilter
    ): { filter: Filter; fromDataSource: boolean; idx: number } | null {
        const sets = [
            {
                filters: this.visualizationFilters,
                fromDataSource: false,
            },
            {
                filters: this.dataSourceFilters,
                fromDataSource: true,
            },
        ];
        for (let { filters, fromDataSource } of sets) {
            for (let idx = 0; idx < filters.length; idx += 1) {
                const filter = filters[idx];
                if (filterMatchesSpec(filter, spec)) {
                    return { filter: filter as Filter, fromDataSource, idx };
                }
            }
        }
        return null;
    }

    private entryMatchesFilters(entry: ProcessedLogEntry): boolean {
        // Match all filters (AND)
        for (let filter of this.dataSourceFilters.concat(this.visualizationFilters)) {
            if (!filterMatches(filter, entry)) {
                return false;
            }
        }
        return true;
    }

    getEntryCellData(entry: ProcessedLogEntry, propertyData: PropertyData): LogCellData {
        let value: JSONType | undefined;
        if (propertyData.processor === 'timestamp') {
            const timezone = this.getTimezoneString();
            value = formatDateInTimeZone(entry.timestamp, timezone, this.timeFormat.timestampFormat);
        } else {
            if (propertyData.selector[0].type === 'compound') {
                let values = new Set(
                    propertyData.selector[0].selectors
                        .map((selector) => entry.propertyValues.get(makeStringFromJSONFieldSelector(selector)))
                        .filter(notEmpty)
                );
                if (values.size === 1) {
                    value = Array.from(values.values())[0];
                } else if (values.size > 1) {
                    value = Array.from(values.values());
                }
            } else {
                const selectorId = makeStringFromJSONFieldSelector(propertyData.selector);
                value = entry.propertyValues.get(selectorId);
            }
        }
        const lines: any[] = typeof value === 'string' ? value.split('\n') : [value];
        const numLines: number = this.multiline ? lines.length : 1;
        return {
            numLines,
            value: this.multiline ? value : lines[0],
            wholeValue: value,
        };
    }

    getDetailColumns(): { columnStart: number; columnEnd: number } {
        const preambleProperties = this.preambleProperties.map(parseFieldSelectorText);
        return {
            columnStart: FIRST_ATTRIBUTE_COL_NUM + preambleProperties.length,
            columnEnd: FIRST_ATTRIBUTE_COL_NUM + preambleProperties.length + this.shownProperties.length + (this.fillerColumn ? 1 : 0),
        };
    }

    getPropertyValueStats(selector: JSONFieldSelector, maxResults: number): FrequencyStats | null {
        if (selector[0].type === 'compound') {
            return mergeFrequencyStats(
                selector[0].selectors
                    .map((selector) => this.entriesSelection.propertyStats.get(makeStringFromJSONFieldSelector(selector)))
                    .filter(notEmpty)
                    .map((tracker) => tracker.getFrequencies(maxResults))
                    .filter(notEmpty),
                maxResults
            );
        }
        const tracker = this.entriesSelection.propertyStats.get(makeStringFromJSONFieldSelector(selector));
        if (!tracker) {
            return null;
        }
        return tracker.getFrequencies(maxResults);
    }

    getDataSourceName(): string {
        return this.getCurrentDataSource().name;
    }
}

const sum = (a: number, b: number): number => a + b;

class LogEntriesStorage {
    public entries: ProcessedLogEntry[];

    constructor() {
        this.entries = [];
    }

    addEntriesBlock(entries: InputLogEntry[]): void {
        for (let entry of entries) {
            this.add(entry);
        }
    }

    private add(entry: InputLogEntry): void {
        let propertyValues: Map<string, JSONType> = new Map();
        const payloadIntrospection = inspectPayload(entry.payload, (selector, value) => {
            const selectorId = makeStringFromJSONFieldSelector(selector);
            propertyValues.set(selectorId, value);
        });
        this.entries.push({
            id: entry.id,
            payload: entry.payload,
            timestamp: entry.ts,
            propertyValues,
            payloadIntrospection,
        });
    }
}

class LogEntriesSelection {
    public entries: ProcessedLogEntry[];
    public rootPropertyNode: PropertyNode;
    public propertyStats: Map<string, PropertyValueStatsCalculator>;
    private timeBucketsAggregator: TimeBucketsAggregator | null;
    private timeRange: TimeRange | null;

    constructor(
        private filter: (entry: ProcessedLogEntry) => boolean,
        timeConstraints: { timeRange: TimeRange; bucketSizeInMs: number } | null,
        knownPropertiesMap: Map<string, PropertyConfiguration>
    ) {
        this.rootPropertyNode = EMPTY_PROPERTY_NODE_ROOT();
        this.propertyStats = new Map();
        this.entries = [];
        this.timeRange = timeConstraints ? timeConstraints.timeRange : null;
        this.timeBucketsAggregator = timeConstraints
            ? aggregateByTimestamp(timeConstraints.timeRange, timeConstraints.bucketSizeInMs)
            : null;
        for (let propertyConf of knownPropertiesMap.values()) {
            if (propertyConf.knownValues) {
                for (let knownValue of propertyConf.knownValues) {
                    this.trackPropertyValue(propertyConf.selector, knownValue.value, 0);
                }
            }
        }

        makeObservable(this, {
            entries: observable,
            rootPropertyNode: observable,
            propertyStats: observable,

            filterEntries: action,
        });
    }

    filterEntries(entries: ProcessedLogEntry[]): void {
        for (let entry of entries) {
            this.processEntry(entry);
        }
        this.sortEntries();
        calculatePropertyNodeSize(this.rootPropertyNode);
    }

    private processEntry(entry: ProcessedLogEntry): void {
        if (this.timeRange && !timestampInRange(entry.timestamp, this.timeRange)) {
            return;
        }

        if (!this.filter(entry)) {
            return;
        }

        this.entries.push(entry);

        visitPayload(entry.payloadIntrospection, this.rootPropertyNode, (selector, value) => {
            const selectorId = makeStringFromJSONFieldSelector(selector);
            this.trackPropertyValue(selectorId, value, 1);
        });

        if (this.timeBucketsAggregator) {
            this.timeBucketsAggregator.add(entry.timestamp);
        }
    }

    private getPropertyValueStats(selectorText: string): PropertyValueStatsCalculator {
        let propertyValuesStats: PropertyValueStatsCalculator | undefined = this.propertyStats.get(selectorText);
        if (!propertyValuesStats) {
            propertyValuesStats = new PropertyValueStatsCalculator();
            this.propertyStats.set(selectorText, propertyValuesStats);
        }
        return propertyValuesStats;
    }

    private trackPropertyValue(selectorText: string, value: JSONBasicType, amount: number): void {
        const propertyValuesStats = this.getPropertyValueStats(selectorText);
        propertyValuesStats.trackValue(value, amount);
    }

    private sortEntries(): void {
        this.entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
    }

    public getHistogram(): HistogramDataSeries[] {
        if (!this.timeBucketsAggregator) {
            throw new Error('timeBucketsAggregator not initialized');
        }
        return [
            {
                propertyValue: null,
                datapoints: this.timeBucketsAggregator.getBuckets(),
            },
        ];
    }
}
