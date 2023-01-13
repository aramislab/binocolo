import ConfStore from 'conf';
import { Static, Type } from '@sinclair/typebox';
import { stat } from 'node:fs/promises';
import { DataSourceSpecification } from './data-sources.js';
import Ajv from 'ajv';

const LocalConfigurationDataV1Schema = Type.Object({
    v: Type.Literal(1),
    conf: Type.Object({
        currentDataSourceId: Type.String(),
        dataSources: Type.Array(
            Type.Object({
                id: Type.String(),
                name: Type.String(),
                adapter: Type.Union([
                    Type.Object({
                        type: Type.Literal('AWSCloudWatch'),
                        region: Type.String(),
                        logGroupNames: Type.Array(Type.String()),
                    }),
                ]),
                knownProperties: Type.Array(
                    Type.Object({
                        selector: Type.String(),
                        name: Type.Optional(Type.String()),
                        width: Type.Optional(Type.Number()),
                        grow: Type.Optional(Type.Boolean()),
                        timestamp: Type.Optional(Type.Boolean()),
                        distinctColorsForValues: Type.Optional(Type.Boolean()),
                        knownValues: Type.Optional(
                            Type.Array(
                                Type.Object({
                                    value: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
                                    color: Type.Optional(
                                        Type.Union([Type.Literal('error'), Type.Literal('warning'), Type.Literal('normal')])
                                    ),
                                })
                            )
                        ),
                    })
                ),
            })
        ),
    }),
});
type LocalConfigurationDataV1 = Static<typeof LocalConfigurationDataV1Schema>;

export class LocalConfiguration {
    private store: ConfStore;
    public path: string;

    constructor() {
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

    initialize(dataSourceSpec: DataSourceSpecification): void {
        const data: LocalConfigurationDataV1 = {
            v: 1,
            conf: {
                currentDataSourceId: dataSourceSpec.id,
                dataSources: [dataSourceSpec],
            },
        };
        this.store.set('data', data);
    }

    addDataSource(dataSourceSpec: DataSourceSpecification): void {
        let data = this.getData();
        for (let other of data.conf.dataSources) {
            if (other.id === dataSourceSpec.id) {
                throw new Error(`This data source ID already exists: ${dataSourceSpec.id}`);
            }
        }
        data.conf.dataSources.push(dataSourceSpec);
        this.store.set('data', data);
    }

    private getData(): LocalConfigurationDataV1 {
        const data: any = this.store.get('data');
        return getLocalConfigurationDataV1(data, this.path);
    }

    getDataSources(): DataSourceSpecification[] {
        return this.getData().conf.dataSources;
    }

    getCurrentDataSourceId(): string {
        return this.getData().conf.currentDataSourceId;
    }

    setCurrentDataSourceId(dataSourceId: string): void {
        let data = this.getData();
        for (let dataSource of data.conf.dataSources) {
            if (dataSource.id === dataSourceId) {
                if (data.conf.currentDataSourceId !== dataSourceId) {
                    data.conf.currentDataSourceId = dataSourceId;
                    this.store.set('data', data);
                }
                return;
            }
        }
        throw new Error(`Invalid data source ID: ${dataSourceId}`);
    }
}

export type EmptyValue = null | undefined | false;

function notEmpty<TValue>(value: TValue | EmptyValue): value is TValue {
    return value !== null && value !== undefined && value !== false;
}

function getLocalConfigurationDataV1(data: any, path: string): LocalConfigurationDataV1 {
    if (!data || !data.v) {
        throw new Error(`Invalid config data at ${path}`);
    }
    if (data.v === 1) {
        const ajv = new Ajv();
        const valid = ajv.validate(LocalConfigurationDataV1Schema, data);
        if (!valid) {
            const errors: string[] = ajv.errors ? ajv.errors.map((err) => err.message).filter(notEmpty) : [];
            throw new Error([`Invalid config data version ${data.v} at ${path}:`, ...errors].join('\n'));
        }
        return data;
    } else {
        throw new Error(`Unknown config data version ${data.v} at ${path}`);
    }
}
