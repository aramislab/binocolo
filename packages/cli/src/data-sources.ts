import { Logger } from '@binocolo/backend/logging.js';
import { IDataSourceAdapter } from '@binocolo/backend/types.js';
import { CloudwatchLogsAdapter } from '@binocolo/aws/aws-adapter.js';

import { DataSourceAdapterSpecification } from '@binocolo/serialization/types.js';

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
