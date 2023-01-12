import { DataSourceFilter } from '@binocolo/common/common.js';
import { ProcessedLogEntry } from '../types.js';

export type FilterHandler = {
    id(filter: DataSourceFilter): string;
    matches(filter: DataSourceFilter, entry: ProcessedLogEntry): boolean;
    description(filter: DataSourceFilter): string;
};

export interface IFilterHandler {
    id: string;
    description: string;
    matches(entry: ProcessedLogEntry): boolean;
}
