import { MatchDataSourceFilter } from '@binocolo/common/common.js';
import { FilterHandler } from './types.js';

export const MatchFilter: FilterHandler = {
    id({ selector, include, values }: MatchDataSourceFilter): string {
        return `MatchField:${include}:${selector}:${values.join('+')}`;
    },
    description({ selector, include, values, exact }: MatchDataSourceFilter): string {
        if (values.length === 1) {
            return `${selector} ${exact ? (include ? '=' : '≠') : include ? '~' : '!~'} ${JSON.stringify(values[0])}`;
        } else {
            return `${selector} ${include ? 'includes any of' : 'include none of'} ${
                values.length < 5 ? JSON.stringify(values) : `${values.length} values`
            }`;
        }
    },
};
