import { AWSCloudWatchDataSourceSpecification } from '@binocolo/aws/aws-adapter.js';
import { AWSS3DataSourceSetSpecification } from '@binocolo/aws/aws-s3-config-storage.js';
import { DataSourceSpecification, DataSourceId } from '@binocolo/backend/service.js';
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
    currentDataSourceId: DataSourceId;
    dataSources: {
        spec: DataSourceSpecification<ServiceSpecs>;
        savedSearches: NamedSearch[];
    }[];
    dataSourcesSets: LocalDataSourceSetDescriptor[];
};

export type LocalDataSourceSetDescriptor = {
    id: string;
    name: string;
    spec: DataSourceSetSpecification;
};
