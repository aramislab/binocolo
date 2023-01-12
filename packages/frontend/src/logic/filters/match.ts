import { MatchDataSourceFilter } from '@binocolo/common/common.js';
import { ProcessedLogEntry } from '../types.js';
import { FilterHandler } from './types.js';

export const MatchFilter: FilterHandler = {
    id({ selector, include, values }: MatchDataSourceFilter): string {
        return `MatchField:${include}:${selector}:${values.join('+')}`;
    },
    description({ selector, include, values }: MatchDataSourceFilter): string {
        if (values.length === 1) {
            return `${selector} ${include ? '=' : '≠'} ${JSON.stringify(values[0])}`;
        } else {
            return `${selector} ${include ? 'includes any of' : 'include none of'} ${
                values.length < 5 ? JSON.stringify(values) : `${values.length} values`
            }`;
        }
    },
    matches({ selector, include, values }: MatchDataSourceFilter, entry: ProcessedLogEntry): boolean {
        if (include) {
            for (let _selector of selector.split('+')) {
                const value = entry.propertyValues.get(_selector);
                for (let acceptableValue of values) {
                    if (value === acceptableValue) {
                        return true;
                    }
                }
            }
            return false;
        } else {
            for (let _selector of selector.split('+')) {
                const value = entry.propertyValues.get(_selector);
                for (let unacceptableValue of values) {
                    if (value === unacceptableValue) {
                        return false;
                    }
                }
            }
            return true;
        }
    },
};
