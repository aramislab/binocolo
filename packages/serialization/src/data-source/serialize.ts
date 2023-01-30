import { ServiceSpecs } from '../types.js';
import { DataSourceSpecification } from '@binocolo/backend/service.js';
import { validateJson } from '@binocolo/backend/json-validation.js';
import { SerializedDataSourceSpecifications, SerializedDataSourceSpecificationsSchema } from './types.js';

export function serializeDataSourceSpecification(dataSource: DataSourceSpecification<ServiceSpecs>): SerializedDataSourceSpecifications {
    return {
        v: 1,
        dataSource,
    };
}

export function deserializeDataSourceSpecification(
    data: any,
    dataName: string
): { dataSource: DataSourceSpecification<ServiceSpecs>; obsolete: boolean } {
    const dataOnDisk = validateJson<SerializedDataSourceSpecifications>(
        data,
        SerializedDataSourceSpecificationsSchema,
        `data sources in ${dataName}`
    );
    const version = dataOnDisk.v;
    switch (version) {
        case 1:
            return {
                dataSource: dataOnDisk.dataSource,
                obsolete: false,
            };
        // case 2:
        //     return {
        //         dataSources: dataOnDisk.dataSources,
        //         obsolete: false,
        //     };
        default:
            const exhaustiveCheck: never = version;
            throw new Error(`Unhandled dataOnDisk.v: ${exhaustiveCheck}`);
    }
}
