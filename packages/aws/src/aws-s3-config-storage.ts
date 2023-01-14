import { Logger } from '@binocolo/backend/logging';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { IDataSourceSpecificationsStorage } from '@binocolo/backend/types.js';

type CloudwatchS3ConfigStorageParams<DataSourceSpecification> = {
    region: string;
    bucket: string;
    prefix: string;
    logger: Logger;
    verbose?: boolean;
    deserializeDataSourceSpecifications(data: any, dataName: string): { dataSources: DataSourceSpecification[]; obsolete: boolean };
    serializeDataSourceSpecifications(dataSources: DataSourceSpecification[]): any;
};

export type AWSS3DataSourceSetSpecification = {
    type: 'AWSS3';
    region: string;
    bucket: string;
    prefix: string;
};

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
            if (other.id === dataSourceSpec.id) {
                throw new Error(`This data source ID already exists: ${dataSourceSpec.id}`);
            }
        }
        dataSources.push(dataSourceSpec);
        await this.setData(dataSources);
    }

    async getDataSources(): Promise<DataSourceSpecification[]> {
        const key = `${this.params.prefix}${this.params.prefix.length > 0 ? '/' : ''}dataSources.json`;
        const uri = `s3://${this.params.bucket}/${key}`;
        if (this.params.verbose) {
            this.params.logger.info(`Reading object from ${uri}`);
        }
        let responseText: string;
        try {
            const response = await this.client.send(
                new GetObjectCommand({
                    Bucket: this.params.bucket,
                    Key: key,
                })
            );
            if (!response.Body) {
                return [];
            }
            responseText = await response.Body.transformToString();
        } catch (err) {
            if ((err as any)['$metadata'] && (err as any)['$metadata'].httpStatusCode === 404) {
                // Does not exist
                return [];
            }
            throw err;
        }
        const { dataSources, obsolete } = this.params.deserializeDataSourceSpecifications(
            JSON.parse(responseText),
            `data sources on ${uri}`
        );
        if (obsolete) {
            await this.setData(dataSources);
        }
        return dataSources;
    }

    private async setData(dataSources: DataSourceSpecification[]): Promise<void> {
        const key = `${this.params.prefix}${this.params.prefix.length > 0 ? '/' : ''}dataSources.json`;
        const body = this.params.serializeDataSourceSpecifications(dataSources);
        const uri = `s3://${this.params.bucket}/${key}`;
        if (this.params.verbose) {
            this.params.logger.info(`Writing object to ${uri}`);
        }
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.params.bucket,
                Key: key,
                Body: JSON.stringify(body, null, 2),
                ContentType: 'application/json',
            })
        );
    }
}
