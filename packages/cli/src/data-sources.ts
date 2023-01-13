import { AWSCloudWatchDataSourceSpecification } from '@binocolo/aws/aws-adapter.js';
import { Logger } from '@binocolo/backend/logging.js';
import { IDataSourceAdapter } from '@binocolo/backend/types.js';
import { CloudwatchLogsAdapter } from '@binocolo/aws/aws-adapter.js';
import { PropertyConfiguration } from '@binocolo/common/common.js';

export type DataSourceAdapterSpecification = AWSCloudWatchDataSourceSpecification;

export type DataSourceSpecification = {
    id: string;
    name: string;
    adapter: DataSourceAdapterSpecification;
    knownProperties: PropertyConfiguration[];
};

export function getDataSourceAdapterFromSpec(spec: DataSourceAdapterSpecification, logger: Logger, verbose: boolean): IDataSourceAdapter {
    const type = spec.type;
    switch (type) {
        case 'AWSCloudWatch':
            return new CloudwatchLogsAdapter({
                region: spec.region,
                logger,
                verbose,
                logGroupNames: spec.logGroupNames,
            });
        default:
            const exhaustiveCheck: never = type;
            throw new Error(`Unhandled DataSourceAdapterSpecification type: ${exhaustiveCheck}`);
    }
}
