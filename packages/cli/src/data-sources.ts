import { AWSCloudWatchDataSourceSpecification } from '@binocolo/aws/aws-adapter.js';
import { Logger } from '@binocolo/backend/logging.js';
import { IDataSourceAdapter } from '@binocolo/backend/types.js';
import { CloudwatchLogsAdapter } from '@binocolo/aws/aws-adapter.js';
import { Static, Type } from '@sinclair/typebox';
import { validateJson } from '@binocolo/backend/json-validation.js';
import { AWSS3DataSourceSetSpecification } from '@binocolo/aws/aws-s3-config-storage.js';
import { DataSourceSpecification } from '@binocolo/backend/service.js';

export type DataSourceAdapterSpecification = AWSCloudWatchDataSourceSpecification;

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

const CurrentSerializedDataSourceSpecificationsSchema = Type.Object({
    v: Type.Literal(1),
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
                                color: Type.Optional(Type.Union([Type.Literal('error'), Type.Literal('warning'), Type.Literal('normal')])),
                            })
                        )
                    ),
                })
            ),
        })
    ),
});
type CurrentSerializedDataSourceSpecifications = Static<typeof CurrentSerializedDataSourceSpecificationsSchema>;

const SerializedDataSourceSpecificationsSchema = Type.Union([CurrentSerializedDataSourceSpecificationsSchema]);
type SerializedDataSourceSpecifications = Static<typeof SerializedDataSourceSpecificationsSchema>;

export function deserializeDataSourceSpecifications(
    data: any,
    dataName: string
): { dataSources: DataSourceSpecification<DataSourceAdapterSpecification>[]; obsolete: boolean } {
    const dataOnDisk = validateJson<SerializedDataSourceSpecifications>(
        data,
        SerializedDataSourceSpecificationsSchema,
        `data sources in ${dataName}`
    );
    let obsolete: boolean = false;
    if (dataOnDisk.v !== 1) {
        obsolete = true;
    }
    return {
        dataSources: dataOnDisk.dataSources,
        obsolete,
    };
}

export function serializeDataSourceSpecifications(
    dataSources: DataSourceSpecification<DataSourceAdapterSpecification>[]
): CurrentSerializedDataSourceSpecifications {
    return {
        v: 1,
        dataSources,
    };
}

export type DataSourceSetSpecification = LocalDataSourceSetSpecification | AWSS3DataSourceSetSpecification;

type LocalDataSourceSetSpecification = {
    type: 'local';
};

export type LocalDataSourceSetDescriptor = {
    id: string;
    name: string;
    spec: DataSourceSetSpecification;
};
