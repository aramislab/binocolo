import { DAY, TimeRange } from './types.js';

type BucketSpec = {
    name: string;
    durationInMs: number;
    format: string;
};

class BucketSpecsBuilder {
    private specs: BucketSpec[];
    constructor() {
        this.specs = [];
    }
    add(multiplier: number, name: string, format: string): BucketSpecsBuilder {
        if (this.specs.length === 0) {
            this.specs.push({ name, durationInMs: multiplier, format });
        } else {
            const previousDuration: number = this.specs[this.specs.length - 1].durationInMs;
            this.specs.push({ name, durationInMs: previousDuration * multiplier, format });
        }
        return this;
    }
    getSpecs(): { asc: BucketSpec[]; desc: BucketSpec[] } {
        let desc = Array.from(this.specs);
        desc.reverse();
        return { asc: this.specs, desc };
    }
}

const { asc: BUCKET_SPECS_ASC, desc: BUCKET_SPECS_DESC } = new BucketSpecsBuilder()
    .add(1, '1 ms', 'HH:mm:ss.SSS')
    .add(5, '5 ms', 'HH:mm:ss.SSS')
    .add(2, '10 ms', 'HH:mm:ss.SSS')
    .add(5, '50 ms', 'HH:mm:ss.SSS')
    .add(2, '100 ms', 'HH:mm:ss.SSS')
    .add(5, '500 ms', 'HH:mm:ss.SSS')
    .add(2, '1 s', 'HH:mm:ss')
    .add(5, '5 s', 'HH:mm:ss')
    .add(2, '10 s', 'HH:mm:ss')
    .add(3, '30 s', 'HH:mm:ss')
    .add(2, '1 min', 'HH:mm:ss')
    .add(5, '5 min', 'HH:mm:ss')
    .add(2, '10 min', 'HH:mm:ss')
    .add(3, '30 min', 'HH:mm:ss')
    .add(2, '1 hour', 'MM-dd HH:mm')
    .add(3, '3 hours', 'MM-dd HH:mm')
    .add(2, '6 hours', 'MM-dd HH:mm')
    .add(2, '12 hours', 'MM-dd HH:mm')
    .add(2, '1 day', 'MM-dd')
    .getSpecs();

// Sanity check
if (BUCKET_SPECS_ASC[BUCKET_SPECS_ASC.length - 1].durationInMs !== DAY) {
    throw new Error('Sanity check error: wrong number of milliseconds in one day');
}

const MIN_NUM_BARS_IN_GRAPH = 100;

function determineBucketSize(range: TimeRange): BucketSpec {
    const duration = range.end - range.start;
    for (let bucketSpec of BUCKET_SPECS_DESC) {
        if (duration / bucketSpec.durationInMs >= MIN_NUM_BARS_IN_GRAPH) {
            return bucketSpec;
        }
    }
    return BUCKET_SPECS_DESC[BUCKET_SPECS_DESC.length - 1];
}

function getFirstBucketSizeGreaterOrEqualTo(durationMs: number): BucketSpec | null {
    let specs = Array.from(BUCKET_SPECS_DESC);
    specs.reverse();
    for (let spec of specs) {
        if (spec.durationInMs >= durationMs) {
            return spec;
        }
    }
    return null;
}

const roundTo = (value: number, size: number): number => Math.floor(value / size) * size;

export const timestampInRange = (timestamp: number, timeRange: TimeRange): boolean =>
    timeRange.start <= timestamp && timestamp <= timeRange.end;

export type ElaboratedTimeRange = {
    timeRange: TimeRange;
    bucketSpec: BucketSpec;
    timestamps: number[];
};

export const elaborateTimeRange = (timeRange: TimeRange, minBucketSize?: number): ElaboratedTimeRange => {
    let bucketSpec = determineBucketSize(timeRange);
    if (minBucketSize && bucketSpec.durationInMs < minBucketSize) {
        let newSpec = getFirstBucketSizeGreaterOrEqualTo(minBucketSize);
        if (!newSpec) {
            throw new Error(`Cannot find a bucket size larger than ${minBucketSize}`);
        }
        bucketSpec = newSpec;
        if (bucketSpec.durationInMs > timeRange.end - timeRange.start) {
            throw new Error(`Bucket size (${minBucketSize}) larger than the time range itself (${timeRange.end - timeRange.start})`);
        }
    }
    let timestamps: number[] = [];
    const start = roundTo(timeRange.start, bucketSpec.durationInMs);
    for (let bucket = start; bucket <= timeRange.end; bucket += bucketSpec.durationInMs) {
        timestamps.push(bucket);
    }
    return {
        timeRange: {
            start,
            end: timestamps[timestamps.length - 1],
        },
        bucketSpec,
        timestamps,
    };
};

export type TimeBucketsAggregator = {
    add(timestamp: number): void;
    getBuckets(): (number | null)[];
};

export const aggregateByTimestamp = (timeRange: TimeRange, bucketSizeInMs: number): TimeBucketsAggregator => {
    const bucketsMap: Map<number, number> = new Map();

    return {
        add(timestamp: number) {
            if (!timestampInRange(timestamp, timeRange)) {
                throw new Error('Unexpected timestamp outside of range');
            }
            const bucket = roundTo(timestamp, bucketSizeInMs);
            bucketsMap.set(bucket, (bucketsMap.get(bucket) || 0) + 1);
        },
        getBuckets() {
            let buckets: (number | null)[] = [];
            for (let bucket = timeRange.start; bucket <= timeRange.end; bucket += bucketSizeInMs) {
                buckets.push(bucketsMap.get(bucket) || null);
            }
            return buckets;
        },
    };
};

export function durationToText(timeRange: TimeRange): string {
    const numberOfMillis = timeRange.end - timeRange.start;
    if (numberOfMillis < 1000) {
        return `${numberOfMillis} ms`;
    }
    const sec = Math.round(numberOfMillis / 1000);
    if (sec < 60) {
        return `~ ${sec} sec`;
    }
    const min = Math.round(sec / 60);
    if (min < 60) {
        return `~ ${min} min`;
    }
    const hours = Math.round(min / 60);
    if (hours < 24) {
        return `~ ${hours} h`;
    }
    const days = Math.round(hours / 24);
    return `~ ${days} days`;
}
