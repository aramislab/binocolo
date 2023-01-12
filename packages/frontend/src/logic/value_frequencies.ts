import { JSONBasicType, JSONBasicTypeName } from '@binocolo/common/common.js';
import { getJSONBasicTypeOf } from './inspect_payload.js';

type FrequencyMap = Map<JSONBasicType, number>;

export type FrequencyStats = {
    total: number;
    allFrequencies: ValueFrequency[];
    frequencies: ValueFrequency[];
    all: OccurrencesByTypeName[];
    more: OccurrencesByTypeName[];
};

type ValueFrequency = {
    typeName: JSONBasicTypeName;
    value: JSONBasicType;
    occurrences: number;
};

type OccurrencesByTypeName = {
    typeName: JSONBasicTypeName;
    occurrences: number;
    values: JSONBasicType[];
};

export class PropertyValueStatsCalculator {
    private valueTypes: Map<JSONBasicTypeName, FrequencyMap>;

    constructor() {
        this.valueTypes = new Map();
    }

    trackValue(value: JSONBasicType, amount: number): void {
        const typeName = getJSONBasicTypeOf(value);
        let frequencies: FrequencyMap | undefined = this.valueTypes.get(typeName);
        if (!frequencies) {
            frequencies = new Map();
            this.valueTypes.set(typeName, frequencies);
        }
        const occurrences: number = frequencies.get(value) || 0;
        frequencies.set(value, occurrences + amount);
    }

    getFrequencies(maxResults: number): FrequencyStats | null {
        let total: number = 0;
        let frequencies: ValueFrequency[] = [];
        for (let [typeName, freq] of this.valueTypes.entries()) {
            for (let [value, occurrences] of freq.entries()) {
                frequencies.push({ value, typeName, occurrences });
                total += occurrences;
            }
        }
        if (frequencies.length === 0) {
            return null;
        }
        frequencies.sort(compareByOccurrences);

        let othersMap = mapOfSets();
        let allMap = mapOfSets();
        for (let idx = 0; idx < frequencies.length; idx += 1) {
            let { typeName, value } = frequencies[idx];
            allMap.add(typeName, value);
            if (idx >= maxResults) {
                othersMap.add(typeName, value);
            }
        }
        return {
            total,
            allFrequencies: frequencies,
            frequencies: frequencies.slice(0, maxResults),
            all: allMap.getOccurrencesByTypeName(),
            more: othersMap.getOccurrencesByTypeName(),
        };
    }
}

const mapOfSets = () => {
    let map: Map<JSONBasicTypeName, Set<string>> = new Map();
    return {
        add(typeName: JSONBasicTypeName, value: JSONBasicType) {
            let valuesSet: Set<string> | undefined = map.get(typeName);
            if (!valuesSet) {
                valuesSet = new Set();
                map.set(typeName, valuesSet);
            }
            valuesSet.add(`${value}`);
        },
        getOccurrencesByTypeName(): OccurrencesByTypeName[] {
            let results: OccurrencesByTypeName[] = Array.from(map.entries()).map(([typeName, valuesSet]) => ({
                typeName,
                occurrences: valuesSet.size,
                values: Array.from(valuesSet.values()),
            }));
            results.sort(compareByOccurrences);
            return results;
        },
    };
};

const compareByOccurrences = <T extends { occurrences: number }>({ occurrences: a }: T, { occurrences: b }: T): 1 | -1 | 0 =>
    a > b ? -1 : a < b ? 1 : 0;

export function mergeFrequencyStats(stats: FrequencyStats[], maxResults: number): FrequencyStats | null {
    const calculator = new PropertyValueStatsCalculator();
    for (let { allFrequencies } of stats) {
        for (let { value, occurrences } of allFrequencies) {
            calculator.trackValue(value, occurrences);
        }
    }
    return calculator.getFrequencies(maxResults);
}
