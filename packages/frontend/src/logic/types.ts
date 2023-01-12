import { JSONBasicType, JSONBasicTypeName, JSONFieldSelector, JSONType } from '@binocolo/common/common.js';
export const REFERENCE_TEXT_SIZE = 12;
export const LINE_HEIGHT = 1.5;

// -- Constants --------------------

export const FIXED_COLUMNS_WIDTHS: number[] = [60];
export const FIRST_ATTRIBUTE_COL_NUM = FIXED_COLUMNS_WIDTHS.length + 1;

export const SERIF_FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`;
export const MONOSPACE_FONT = `source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace`;

// -- Utils ------------------------

export type EmptyValue = null | undefined | false;

export function notEmpty<TValue>(value: TValue | EmptyValue): value is TValue {
    return value !== null && value !== undefined && value !== false;
}

export function notNullNumber(value: number | null): value is number {
    return value !== null;
}

export function makePercentage(value: number): string {
    if (isNaN(value)) {
        return '';
    }
    const value100 = value * 100;
    return `${value100 >= 10 ? Math.round(value100) : value100 >= 1 ? value100.toFixed(1) : value100.toFixed(2)}%`;
}

// -- Introspection --------------------

export type PayloadIntrospection = ArrayIntrospection | ObjectIntrospection | BasicTypeIntrospection;

export type ArrayIntrospection = {
    type: 'array';
    selector: JSONFieldSelector;
    elements: PayloadIntrospection[];
    numLines: number;
};

export type ObjectIntrospection = {
    type: 'object';
    selector: JSONFieldSelector;
    elements: ObjectEntryIntrospection[];
    numLines: number;
};

export type ObjectEntryIntrospection = {
    name: string;
    value: PayloadIntrospection;
};

export type BasicTypeIntrospection = {
    type: JSONBasicTypeName;
    selector: JSONFieldSelector;
    value: JSONBasicType;
    numLines: number;
};

// -- Properties --------------------

export type PropertyData = {
    selector: JSONFieldSelector;
    name: string;
    tonedDown: boolean;
    column: number;
    processor: 'normal' | 'timestamp';
    getColor: (value: JSONType) => string | null;
};

export type PropertyNode = {
    selector: JSONFieldSelector;
    leafTypes: Set<JSONBasicTypeName | 'array'>;
    children: Map<string, PropertyNode>;
    size: number;
};

// -- Log Entry --------------------

export type ProcessedLogEntry = {
    id: string;
    timestamp: number;
    payload: any;
    propertyValues: Map<string, JSONType>;
    payloadIntrospection: PayloadIntrospection;
};

export type LogCellData = {
    value?: JSONType;
    wholeValue?: JSONType;
    numLines: number;
};

// -- Time --------------------

export type TimeFormat = {
    timestampFormat: string;
};
