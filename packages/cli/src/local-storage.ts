import ConfStore from 'conf';
import { Logger } from '@binocolo/backend/logging';
import { stat } from 'node:fs/promises';
import { DataSourceId, IConfigurationStorage } from '@binocolo/backend/service.js';
import {
    DataSourceWithSavedSearches,
    IDataSourceSetStorage,
    DataSourceSpecification,
    DataSourceSetDescriptor,
} from '@binocolo/backend/types.js';
import { CloudwatchS3ConfigStorage } from '@binocolo/aws/aws-s3-config-storage.js';
import { NamedSearch } from '@binocolo/common/common.js';
import { ServiceSpecs, LocalConfigurationData } from '@binocolo/serialization/types.js';
import { deserializeDataSourceSpecification, serializeDataSourceSpecification } from '@binocolo/serialization/data-source/serialize.js';
import { deserializeSavedSearch, serializeSavedSearch } from '@binocolo/serialization/saved-search/serialize.js';
import { serializeLocalConfuration, deserializeLocalConfiguration } from '@binocolo/serialization/local-configuration/serialize.js';

type LocalConfigurationParams = {
    logger: Logger;
    verbose?: boolean;
};

const LOCAL_DATA_SOURCE_SET_ID = 'local';

export class LocalConfiguration implements IDataSourceSetStorage<ServiceSpecs>, IConfigurationStorage<ServiceSpecs> {
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

    initialize(): void {
        this.setData({
            currentDataSourceId: null,
            dataSources: [],
            dataSourcesSets: [],
        });
    }

    async getDataSourceSetDescriptors(): Promise<DataSourceSetDescriptor<ServiceSpecs>[]> {
        let localSet: DataSourceSetDescriptor<ServiceSpecs> = { id: LOCAL_DATA_SOURCE_SET_ID, name: 'Local', spec: { type: 'local' } };
        if (!(await this.exists())) {
            return [localSet];
        }
        let data = this.getData();
        return [localSet].concat(data.dataSourcesSets);
    }

    addDataSourceSet(setDescriptor: DataSourceSetDescriptor<ServiceSpecs>): void {
        let data = this.getData();
        for (let other of data.dataSourcesSets) {
            if (other.name === setDescriptor.name) {
                throw new Error(`A data source set with name "${setDescriptor.name}" already exists`);
            }
        }
        data.dataSourcesSets.push(setDescriptor);
        this.setData(data);
    }

    // async getAllDataSourceSetStorages(): Promise<IDataSourceSetStorage<ServiceSpecs>[]> {
    //     let sets: IDataSourceSetStorage<ServiceSpecs>[] = [];
    //     for (let descriptor of await this.getDataSourceSetDescriptors()) {
    //         const specType = descriptor.spec.type;
    //         switch (specType) {
    //             case LOCAL_DATA_SOURCE_SET_ID:
    //                 sets.push(this);
    //                 break;
    //             case 'AWSS3':
    //                 sets.push(
    //                     new CloudwatchS3ConfigStorage({
    //                         region: descriptor.spec.region,
    //                         bucket: descriptor.spec.bucket,
    //                         prefix: descriptor.spec.prefix,
    //                         deserializeDataSourceSpecification,
    //                         serializeDataSourceSpecification,
    //                         deserializeSavedSearch,
    //                         serializeSavedSearch,
    //                         logger: this.params.logger,
    //                         verbose: this.params.verbose,
    //                     })
    //                 );
    //                 break;
    //             default:
    //                 const exhaustiveCheck: never = specType;
    //                 throw new Error(`Unhandled descriptor.spec.type: ${exhaustiveCheck}`);
    //         }
    //     }
    //     return sets;
    // }

    async getDataSourceSetStorage(setId: string): Promise<IDataSourceSetStorage<ServiceSpecs>> {
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

    async updateDataSource(dataSourceSpec: DataSourceSpecification<ServiceSpecs>): Promise<void> {
        let data = this.getData();
        for (let other of data.dataSources) {
            if (other.spec.id === dataSourceSpec.id) {
                other.spec = dataSourceSpec;
            }
        }
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

    async getDataSources(): Promise<DataSourceWithSavedSearches<ServiceSpecs>[]> {
        return this.getData().dataSources;
    }

    async getCurrentDataSourceId(): Promise<DataSourceId> {
        const data = this.getData();
        let firstIdFound: DataSourceId | null = null;
        for (let d of await this.getDataSourceSetDescriptors()) {
            const ds = await this.getDataSourceSetStorage(d.id);
            for (let dataSource of await ds.getDataSources()) {
                if (firstIdFound === null) {
                    firstIdFound = {
                        dataSourceSetId: d.id,
                        dataSourceId: dataSource.spec.id,
                    };
                }
                if (
                    data.currentDataSourceId &&
                    d.id === data.currentDataSourceId.dataSourceSetId &&
                    dataSource.spec.id === data.currentDataSourceId.dataSourceId
                ) {
                    return data.currentDataSourceId;
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
                            !data.currentDataSourceId ||
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
        let data = this.getData();
        for (let dataSource of data.dataSources) {
            if (dataSource.spec.id === dataSourceId) {
                dataSource.savedSearches = dataSource.savedSearches.filter((ds) => ds.id !== search.id).concat([search]);
                this.setData(data);
                return;
            }
        }
        throw new Error(`Invalid data source ID: ${dataSourceId}`);
    }
}
