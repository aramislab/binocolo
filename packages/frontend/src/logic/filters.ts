import { DataSourceFilter, DataSourceFilterType } from '@binocolo/common/common.js';
import { ProcessedLogEntry } from './types.js';
import { MatchFilter } from './filters/match.js';
import { ExistsFilter } from './filters/exists.js';
import { FilterHandler } from './filters/types.js';

export const makeFilterId = (filter: DataSourceFilter): string => getFilter(filter).id(filter);

export const makeFilterDescription = (filter: DataSourceFilter): string => getFilter(filter).description(filter);

export const filterMatches = (filter: DataSourceFilter, entry: ProcessedLogEntry): boolean => getFilter(filter).matches(filter, entry);

function getFilter(filter: DataSourceFilter): FilterHandler {
    return FILTER_HANDLERS[filter.type];
}

// function getFilterHandler(filter: DataSourceFilter): IFilterHandler {
//     switch (filter.type) {
//         case 'exists':
//             return new ExistsFilterHandler(filter);
//         case 'match':
//             return new Match(filter);
//     }
//     return FILTER_HANDLERS[filter.type];
// }

const FILTER_HANDLERS: { [k in DataSourceFilterType]: FilterHandler } = {
    match: MatchFilter,
    exists: ExistsFilter,
};
