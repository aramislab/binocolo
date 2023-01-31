import { AWSCloudWatchDataSourceSpecification } from '@binocolo/aws/aws-adapter.js';
import { AWSS3DataSourceSetSpecification } from '@binocolo/aws/aws-s3-config-storage.js';
import { DataSourceId } from '@binocolo/backend/service.js';
import { DataSourceSetDescriptor, DataSourceSpecification } from '@binocolo/backend/types';
import { NamedSearch } from '@binocolo/common/common.js';

export type DataSourceAdapterSpecification = AWSCloudWatchDataSourceSpecification;

export type DataSourceSetSpecification = LocalDataSourceSetSpecification | AWSS3DataSourceSetSpecification;

type LocalDataSourceSetSpecification = {
    type: 'local';
};

export type ServiceSpecs = {
    DataSourceAdapter: DataSourceAdapterSpecification;
    DataSourceSet: DataSourceSetSpecification;
};

// ---- Local configuration --------------------

export type LocalConfigurationData = {
    currentDataSourceId: DataSourceId | null;
    dataSources: {
        spec: DataSourceSpecification<ServiceSpecs>;
        savedSearches: NamedSearch[];
    }[];
    dataSourcesSets: DataSourceSetDescriptor<ServiceSpecs>[];
};
