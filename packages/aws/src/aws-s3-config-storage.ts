import { Logger } from '@binocolo/backend/logging';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DataSourceWithSavedSearches, IDataSourceSpecificationsStorage } from '@binocolo/backend/types.js';
import { NamedSearch } from '@binocolo/common/common.js';

type CloudwatchS3ConfigStorageParams<DataSourceSpecification> = {
    region: string;
    bucket: string;
    prefix: string;
    logger: Logger;
    verbose?: boolean;
    deserializeDataSourceSpecification(data: any, dataName: string): { dataSource: DataSourceSpecification; obsolete: boolean };
    serializeDataSourceSpecification(dataSource: DataSourceSpecification): any;
    deserializeSavedSearch(data: any, dataName: string): { savedSearch: NamedSearch; obsolete: boolean };
    serializeSavedSearch(search: NamedSearch): any;
};

export type AWSS3DataSourceSetSpecification = {
    type: 'AWSS3';
    region: string;
    bucket: string;
    prefix: string;
};

const DATA_SOURCE_SPEC_JSON_FILENAME = 'dataSource.json';
const SAVED_SEARCHES_DIR_NAME = 'savedSearches';

export class CloudwatchS3ConfigStorage<DataSourceSpecification extends { id: string }>
    implements IDataSourceSpecificationsStorage<DataSourceSpecification>
{
    private client: S3Client;

    constructor(private params: CloudwatchS3ConfigStorageParams<DataSourceSpecification>) {
        this.client = new S3Client({ region: params.region });
    }

    async addDataSource(dataSourceSpec: DataSourceSpecification): Promise<void> {
        let dataSources = await this.getDataSources();
        for (let other of dataSources) {
            if (other.spec.id === dataSourceSpec.id) {
                throw new Error(`This data source ID already exists: ${dataSourceSpec.id}`);
            }
        }
        await this.writeDataSource(`${dataSourceSpec.id}/${DATA_SOURCE_SPEC_JSON_FILENAME}`, dataSourceSpec);
    }

    private async listObjects(): Promise<string[]> {
        const uri = `s3://${this.params.bucket}/${this.params.prefix}`;
        const prefix = `${this.params.prefix}/`;
        if (this.params.verbose) {
            this.params.logger.info(`Listing objects at ${uri}`);
        }
        const response = await this.client.send(
            new ListObjectsV2Command({
                Bucket: this.params.bucket,
                Prefix: prefix,
            })
        );
        if (!response.Contents) {
            return [];
        }
        const result: string[] = response.Contents.map((content) => content.Key)
            .map((key) => {
                if (key && key.startsWith(prefix)) {
                    return key.slice(prefix.length);
                }
            })
            .filter(notEmpty);
        result.sort();
        return result;
    }

    private categorizeBucketKeys(keys: string[]): DataSourceKeys[] {
        const dataSources: Map<string, DataSourceKeys> = new Map();
        for (let key of keys) {
            const parts = key.split('/');
            if (parts.length === 2 && parts[1] === DATA_SOURCE_SPEC_JSON_FILENAME) {
                const dataSourceId = parts[0];
                if (dataSources.has(dataSourceId)) {
                    throw new Error(`Data source ${dataSourceId} already present in key map`);
                }
                dataSources.set(dataSourceId, {
                    dataSourceSpecKey: key,
                    savedSearcheKeys: [],
                });
            } else if (parts.length === 3 && parts[1] === SAVED_SEARCHES_DIR_NAME && parts[2].endsWith('.json')) {
                const dataSourceId = parts[0];
                const dataSource = dataSources.get(dataSourceId);
                if (!dataSource) {
                    throw new Error(`Data source ${dataSourceId} not present in key map`);
                }
                dataSource.savedSearcheKeys.push(key);
            } else {
                if (this.params.verbose) {
                    this.params.logger.info(`Ignoring key ${key}`);
                }
            }
        }
        return Array.from(dataSources.values());
    }

    private async readJsonObject(key: string): Promise<any> {
        const actualKey = `${this.params.prefix}/${key}`;
        const uri = `s3://${this.params.bucket}/${actualKey}`;
        if (this.params.verbose) {
            this.params.logger.info(`Reading object from ${uri}`);
        }
        try {
            const response = await this.client.send(
                new GetObjectCommand({
                    Bucket: this.params.bucket,
                    Key: actualKey,
                })
            );
            if (!response.Body) {
                return [];
            }
            const responseText = await response.Body.transformToString();
            return JSON.parse(responseText);
        } catch (err) {
            if ((err as any)['$metadata'] && (err as any)['$metadata'].httpStatusCode === 404) {
                // Does not exist
                return null;
            }
            throw err;
        }
    }

    private async writeDataSource(key: string, dataSource: DataSourceSpecification): Promise<void> {
        await this.writeJsonObject(key, this.params.serializeDataSourceSpecification(dataSource));
    }

    private async writeSavedSearch(key: string, savedSearch: NamedSearch): Promise<void> {
        await this.writeJsonObject(key, this.params.serializeSavedSearch(savedSearch));
    }

    private async writeJsonObject(key: string, body: any): Promise<void> {
        const actualKey = `${this.params.prefix}/${key}`;
        const uri = `s3://${this.params.bucket}/${actualKey}`;
        if (this.params.verbose) {
            this.params.logger.info(`Writing object to ${uri}`);
        }
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.params.bucket,
                Key: actualKey,
                Body: JSON.stringify(body, null, 2),
                ContentType: 'application/json',
            })
        );
    }

    private async readDataSourceAtKey(key: string): Promise<DataSourceSpecification> {
        const dataSourceData = await this.readJsonObject(key);
        if (!dataSourceData) {
            throw new Error(`JSON object not found at key ${key}`);
        }
        const { dataSource, obsolete } = this.params.deserializeDataSourceSpecification(dataSourceData, `data source at ${key}`);
        if (obsolete) {
            await this.writeDataSource(key, dataSource);
        }
        return dataSource;
    }

    private async readSavedearchAtKey(key: string): Promise<NamedSearch> {
        const dataSourceData = await this.readJsonObject(key);
        if (!dataSourceData) {
            throw new Error(`JSON object not found at key ${key}`);
        }
        const { savedSearch, obsolete } = this.params.deserializeSavedSearch(dataSourceData, `saved source at ${key}`);
        if (obsolete) {
            await this.writeSavedSearch(key, savedSearch);
        }
        return savedSearch;
    }

    async getDataSources(): Promise<DataSourceWithSavedSearches<DataSourceSpecification>[]> {
        let result: DataSourceWithSavedSearches<DataSourceSpecification>[] = [];
        const bucketKeys = this.categorizeBucketKeys(await this.listObjects());
        for (let { dataSourceSpecKey, savedSearcheKeys } of bucketKeys) {
            const dataSourceSpec = await this.readDataSourceAtKey(dataSourceSpecKey);
            let savedSearches: NamedSearch[] = [];
            for (let savedSearchKey of savedSearcheKeys) {
                savedSearches.push(await this.readSavedearchAtKey(savedSearchKey));
            }
            result.push({
                spec: dataSourceSpec,
                savedSearches,
            });
        }
        return result;
    }

    async saveSearch(dataSourceId: string, search: NamedSearch): Promise<void> {
        const key = `${dataSourceId}/${SAVED_SEARCHES_DIR_NAME}/${search.id}.json`;
        await this.writeSavedSearch(key, search);
    }
}

type EmptyValue = null | undefined | false;

function notEmpty<TValue>(value: TValue | EmptyValue): value is TValue {
    return value !== null && value !== undefined && value !== false;
}

type DataSourceKeys = { dataSourceSpecKey: string; savedSearcheKeys: string[] };
