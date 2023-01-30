import ConfStore from 'conf';
import { Logger } from '@binocolo/backend/logging';
import { stat } from 'node:fs/promises';
import { DataSourceId, DataSourceSpecification, IConfigurationStorage } from '@binocolo/backend/service.js';
import { DataSourceWithSavedSearches, IDataSourceSpecificationsStorage } from '@binocolo/backend/types.js';
import { CloudwatchS3ConfigStorage } from '@binocolo/aws/aws-s3-config-storage.js';
import { NamedSearch } from '@binocolo/common/common.js';
import { ServiceSpecs, LocalDataSourceSetDescriptor, LocalConfigurationData } from '@binocolo/serialization/types.js';
import { deserializeDataSourceSpecification, serializeDataSourceSpecification } from '@binocolo/serialization/data-source/serialize.js';
import { deserializeSavedSearch, serializeSavedSearch } from '@binocolo/serialization/saved-search/serialize.js';
import { serializeLocalConfuration, deserializeLocalConfiguration } from '@binocolo/serialization/local-configuration/serialize.js';

type LocalConfigurationParams = {
    logger: Logger;
    verbose?: boolean;
};

const LOCAL_DATA_SOURCE_SET_ID = 'local';

export class LocalConfiguration
    implements IDataSourceSpecificationsStorage<DataSourceSpecification<ServiceSpecs>>, IConfigurationStorage<ServiceSpecs>
{
    private store: ConfStore;
    public path: string;

    constructor(private params: LocalConfigurationParams) {
        this.store = new ConfStore({
            projectName: 'binocolo',
            projectVersion: '1.0.0', // Not used
            serialize: (value) => JSON.stringify(value, null, 2),
        });
        this.path = this.store.path;
    }

    async exists(): Promise<boolean> {
        try {
            await stat(this.path);
        } catch (err) {
            if ((err as any).code === 'ENOENT') {
                return false;
            }
        }
        return true;
    }

    initialize(dataSourceSpec: DataSourceSpecification<ServiceSpecs>): void {
        this.setData({
            currentDataSourceId: {
                dataSourceSetId: LOCAL_DATA_SOURCE_SET_ID,
                dataSourceId: dataSourceSpec.id,
            },
            dataSources: [
                {
                    spec: dataSourceSpec,
                    savedSearches: [],
                },
            ],
            dataSourcesSets: [],
        });
    }

    async getDataSourceSetDescriptors(): Promise<LocalDataSourceSetDescriptor[]> {
        let data = this.getData();
        let localSet: LocalDataSourceSetDescriptor = { id: LOCAL_DATA_SOURCE_SET_ID, name: 'Local', spec: { type: 'local' } };
        return [localSet].concat(data.dataSourcesSets);
    }

    addDataSourceSet(setDescriptor: LocalDataSourceSetDescriptor): void {
        let data = this.getData();
        for (let other of data.dataSourcesSets) {
            if (other.name === setDescriptor.name) {
                throw new Error(`A data source set with name "${setDescriptor.name}" already exists`);
            }
        }
        data.dataSourcesSets.push(setDescriptor);
        this.setData(data);
    }

    async getDataSourceSetStorage(setId: string): Promise<IDataSourceSpecificationsStorage<DataSourceSpecification<ServiceSpecs>>> {
        for (let descriptor of await this.getDataSourceSetDescriptors()) {
            if (descriptor.id === setId) {
                const specType = descriptor.spec.type;
                switch (specType) {
                    case LOCAL_DATA_SOURCE_SET_ID:
                        return this;
                    case 'AWSS3':
                        return new CloudwatchS3ConfigStorage({
                            region: descriptor.spec.region,
                            bucket: descriptor.spec.bucket,
                            prefix: descriptor.spec.prefix,
                            deserializeDataSourceSpecification,
                            serializeDataSourceSpecification,
                            deserializeSavedSearch,
                            serializeSavedSearch,
                            logger: this.params.logger,
                            verbose: this.params.verbose,
                        });
                    default:
                        const exhaustiveCheck: never = specType;
                        throw new Error(`Unhandled descriptor.spec.type: ${exhaustiveCheck}`);
                }
            }
        }
        throw new Error(`Data source set with name ${name} not found`);
    }

    async addDataSource(dataSourceSpec: DataSourceSpecification<ServiceSpecs>): Promise<void> {
        let data = this.getData();
        for (let other of data.dataSources) {
            if (other.spec.id === dataSourceSpec.id) {
                throw new Error(`This data source ID already exists: ${dataSourceSpec.id}`);
            }
        }
        data.dataSources.push({
            spec: dataSourceSpec,
            savedSearches: [],
        });
        this.setData(data);
    }

    private getData(): LocalConfigurationData {
        const dataName = `config data at ${this.path}`;
        const { localConfiguration, obsolete } = deserializeLocalConfiguration(this.store.get('data'), dataName);
        if (obsolete) {
            this.setData(localConfiguration);
        }
        return localConfiguration;
    }

    private setData(data: LocalConfigurationData) {
        this.store.set('data', serializeLocalConfuration(data));
    }

    async getDataSources(): Promise<DataSourceWithSavedSearches<DataSourceSpecification<ServiceSpecs>>[]> {
        return this.getData().dataSources;
    }

    async getCurrentDataSourceId(): Promise<DataSourceId> {
        const data = this.getData();
        let firstIdFound: DataSourceId | null = null;
        for (let d of await this.getDataSourceSetDescriptors()) {
            if (d.id === data.currentDataSourceId.dataSourceSetId) {
                const ds = await this.getDataSourceSetStorage(d.id);
                for (let dataSource of await ds.getDataSources()) {
                    if (firstIdFound === null) {
                        firstIdFound = {
                            dataSourceSetId: d.id,
                            dataSourceId: dataSource.spec.id,
                        };
                    }
                    if (dataSource.spec.id === data.currentDataSourceId.dataSourceId) {
                        return data.currentDataSourceId;
                    }
                }
            }
        }
        if (firstIdFound) {
            return firstIdFound;
        }
        throw new Error('No data sources defined');
    }

    async setCurrentDataSourceId({ dataSourceSetId, dataSourceId }: DataSourceId): Promise<void> {
        let data = this.getData();
        for (let d of await this.getDataSourceSetDescriptors()) {
            if (d.id === dataSourceSetId) {
                const ds = await this.getDataSourceSetStorage(d.id);
                for (let dataSource of await ds.getDataSources()) {
                    if (dataSource.spec.id === dataSourceId) {
                        if (
                            data.currentDataSourceId.dataSourceSetId !== dataSourceSetId ||
                            data.currentDataSourceId.dataSourceId !== dataSourceId
                        ) {
                            data.currentDataSourceId = {
                                dataSourceSetId,
                                dataSourceId,
                            };
                            this.setData(data);
                        }
                        return;
                    }
                }
            }
        }
        throw new Error(`Invalid data source ID: ${dataSourceId}`);
    }

    async saveSearch(dataSourceId: string, search: NamedSearch): Promise<void> {
        const [setId, dsId] = dataSourceId.split(':');
        if (setId !== LOCAL_DATA_SOURCE_SET_ID) {
            throw new Error(`Invalid data source set ID: ${setId}`);
        }
        let data = this.getData();
        for (let dataSource of data.dataSources) {
            if (dataSource.spec.id === dsId) {
                if (dataSource.savedSearches.map((ds) => ds.id).includes(search.id)) {
                    throw new Error(`Search ID already exists: ${search.id}`);
                }
                dataSource.savedSearches.push(search);
                this.setData(data);
                return;
            }
        }
        throw new Error(`Invalid data source ID: ${dataSourceId}`);
    }
}
