import { DataSourceFilter, DataSourceFilterType } from '@binocolo/common/common.js';
import { MatchFilter } from './filters/match.js';
import { ExistsFilter } from './filters/exists.js';
import { FilterHandler } from './filters/types.js';

export const makeFilterId = (filter: DataSourceFilter): string => getFilter(filter).id(filter);

export const makeFilterDescription = (filter: DataSourceFilter): string => getFilter(filter).description(filter);

function getFilter(filter: DataSourceFilter): FilterHandler {
    return FILTER_HANDLERS[filter.type];
}

const FILTER_HANDLERS: { [k in DataSourceFilterType]: FilterHandler } = {
    match: MatchFilter,
    exists: ExistsFilter,
};
