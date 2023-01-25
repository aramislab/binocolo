import { DataSourceFilter } from '@binocolo/common/common.js';

export type FilterHandler = {
    id(filter: DataSourceFilter): string;
    description(filter: DataSourceFilter): string;
};
