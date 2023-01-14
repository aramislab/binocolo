import ConfStore from 'conf';
import { Logger } from '@binocolo/backend/logging';
import { Static, Type } from '@sinclair/typebox';
import { stat } from 'node:fs/promises';
import {
    LocalDataSourceSetDescriptor,
    deserializeDataSourceSpecifications,
    serializeDataSourceSpecifications,
    ServiceSpecs,
} from './data-sources.js';
import { DataSourceSpecification, IConfigurationStorage } from '@binocolo/backend/service.js';
import { validateJson } from '@binocolo/backend/json-validation.js';
import { IDataSourceSpecificationsStorage } from '@binocolo/backend/types.js';
import { CloudwatchS3ConfigStorage } from '@binocolo/aws/aws-s3-config-storage.js';

const CurrentSerializedLocalConfigurationDataSchema = Type.Object({
    v: Type.Literal(1),
    state: Type.Object({
        currentDataSourceId: Type.String(),
    }),
    dataSources: Type.Any(),
    dataSourcesSets: Type.Array(
        Type.Object({
            id: Type.String(),
            name: Type.String(),
            spec: Type.Union([
                Type.Object({
                    type: Type.Literal('local'),
                }),
                Type.Object({
                    type: Type.Literal('AWSS3'),
                    region: Type.String(),
                    bucket: Type.String(),
                    prefix: Type.String(),
                }),
            ]),
        })
    ),
});
type CurrentSerializedLocalConfigurationData = Static<typeof CurrentSerializedLocalConfigurationDataSchema>;

const SerializedLocalConfigurationDataSchema = Type.Union([CurrentSerializedLocalConfigurationDataSchema]);
type SerializedLocalConfigurationData = Static<typeof SerializedLocalConfigurationDataSchema>;

type LocalConfigurationData = {
    currentDataSourceId: string;
    dataSources: DataSourceSpecification<ServiceSpecs>[];
    dataSourcesSets: LocalDataSourceSetDescriptor[];
};

type LocalConfigurationParams = {
    logger: Logger;
    verbose?: boolean;
};

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
            currentDataSourceId: dataSourceSpec.id,
            dataSources: [dataSourceSpec],
            dataSourcesSets: [],
        });
    }

    async getDataSourceSetDescriptors(): Promise<LocalDataSourceSetDescriptor[]> {
        let data = this.getData();
        let localSet: LocalDataSourceSetDescriptor = { id: 'local', name: 'Local', spec: { type: 'local' } };
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
                    case 'local':
                        return this;
                    case 'AWSS3':
                        return new CloudwatchS3ConfigStorage({
                            region: descriptor.spec.region,
                            bucket: descriptor.spec.bucket,
                            prefix: descriptor.spec.prefix,
                            deserializeDataSourceSpecifications,
                            serializeDataSourceSpecifications,
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
            if (other.id === dataSourceSpec.id) {
                throw new Error(`This data source ID already exists: ${dataSourceSpec.id}`);
            }
        }
        data.dataSources.push(dataSourceSpec);
        this.setData(data);
    }

    private getData(): LocalConfigurationData {
        const dataName = `config data at ${this.path}`;
        let data = validateJson<SerializedLocalConfigurationData>(this.store.get('data'), SerializedLocalConfigurationDataSchema, dataName);
        let { dataSources, obsolete } = deserializeDataSourceSpecifications(data.dataSources, dataName);
        if (data.v !== 1) {
            obsolete = true;
        }
        let result: LocalConfigurationData = {
            currentDataSourceId: data.state.currentDataSourceId,
            dataSources,
            dataSourcesSets: data.dataSourcesSets,
        };
        if (obsolete) {
            this.setData(result);
        }
        return result;
    }

    private setData(data: LocalConfigurationData) {
        const dataOnDisk: CurrentSerializedLocalConfigurationData = {
            v: 1,
            state: {
                currentDataSourceId: data.currentDataSourceId,
            },
            dataSources: serializeDataSourceSpecifications(data.dataSources),
            dataSourcesSets: data.dataSourcesSets,
        };
        this.store.set('data', dataOnDisk);
    }

    async getDataSources(): Promise<DataSourceSpecification<ServiceSpecs>[]> {
        return this.getData().dataSources;
    }

    async getCurrentDataSourceId(): Promise<string> {
        return this.getData().currentDataSourceId;
    }

    async setCurrentDataSourceId(dataSourceId: string): Promise<void> {
        let data = this.getData();
        const [setId, dsId] = dataSourceId.split(':');
        for (let d of await this.getDataSourceSetDescriptors()) {
            if (d.id === setId) {
                const ds = await this.getDataSourceSetStorage(d.id);
                for (let dataSource of await ds.getDataSources()) {
                    if (dataSource.id === dsId) {
                        if (data.currentDataSourceId !== dsId) {
                            data.currentDataSourceId = dataSourceId;
                            this.setData(data);
                        }
                        return;
                    }
                }
            }
        }
        throw new Error(`Invalid data source ID: ${dataSourceId}`);
    }
}
