import { ExistsDataSourceFilter } from '@binocolo/common/common.js';
import { ProcessedLogEntry } from '../types.js';
import { FilterHandler, IFilterHandler } from './types.js';

export class ExistsFilterHandler implements IFilterHandler {
    public id: string;
    public description: string;
    constructor(private filter: ExistsDataSourceFilter) {
        const { selector, exists, considerNulls } = filter;
        this.id = `ExistsField:${exists}:${considerNulls ? 'with' : 'w/o'}nulls:${selector}`;
        this.description = this.getDescription();
    }
    private getDescription(): string {
        const { selector, exists, considerNulls } = this.filter;
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
    }
    matches(entry: ProcessedLogEntry): boolean {
        const { selector, exists, considerNulls } = this.filter;
        const value = entry.propertyValues.get(selector);
        if (exists) {
            if (considerNulls) {
                return value !== undefined && value !== null;
            } else {
                return value !== undefined;
            }
        } else {
            if (considerNulls) {
                return value === undefined || value === null;
            } else {
                return value === undefined;
            }
        }
    }
}

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
    matches({ selector, exists, considerNulls }: ExistsDataSourceFilter, entry: ProcessedLogEntry): boolean {
        const value = entry.propertyValues.get(selector);
        if (exists) {
            if (considerNulls) {
                return value !== undefined && value !== null;
            } else {
                return value !== undefined;
            }
        } else {
            if (considerNulls) {
                return value === undefined || value === null;
            } else {
                return value === undefined;
            }
        }
    },
};
