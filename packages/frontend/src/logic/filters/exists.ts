import { ExistsDataSourceFilter } from '@binocolo/common/common.js';
import { FilterHandler } from './types.js';

export const ExistsFilter: FilterHandler = {
    id({ selector, exists, considerNulls }: ExistsDataSourceFilter): string {
        return `ExistsField:${exists}:${considerNulls ? 'with' : 'w/o'}nulls:${selector}`;
    },
    description({ selector, exists, considerNulls }: ExistsDataSourceFilter): string {
        const selectorText = selector;
        if (exists) {
            if (considerNulls) {
                return `${selectorText} is present and not null`;
            } else {
                return `${selectorText} is present`;
            }
        } else {
            if (considerNulls) {
                return `${selectorText} is not present or is null`;
            } else {
                return `${selectorText} is not present`;
            }
        }
    },
};
