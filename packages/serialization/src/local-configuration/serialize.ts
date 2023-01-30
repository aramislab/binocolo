import { validateJson } from '@binocolo/backend/json-validation.js';
import { LocalConfigurationData } from '../types.js';
import { SerializedLocalConfigurationData, SerializedLocalConfigurationDataSchema } from './types.js';
import { deserializeDataSourceSpecification, serializeDataSourceSpecification } from '../data-source/serialize.js';
import { serializeSavedSearch, deserializeSavedSearch } from '../saved-search/serialize.js';

export function serializeLocalConfuration(data: LocalConfigurationData): SerializedLocalConfigurationData {
    const serializedLocalConfiguration: SerializedLocalConfigurationData = {
        v: 1,
        state: {
            currentDataSourceId: data.currentDataSourceId,
        },
        dataSources: data.dataSources.map((dataSource) => ({
            spec: serializeDataSourceSpecification(dataSource.spec),
            savedSearches: dataSource.savedSearches.map(serializeSavedSearch),
        })),
        dataSourcesSets: data.dataSourcesSets,
    };
    return serializedLocalConfiguration;
}

export function deserializeLocalConfiguration(
    data: any,
    dataName: string
): { localConfiguration: LocalConfigurationData; obsolete: boolean } {
    const dataOnDisk = validateJson<SerializedLocalConfigurationData>(
        data,
        SerializedLocalConfigurationDataSchema,
        `local configuration in ${dataName}`
    );
    const version = dataOnDisk.v;
    switch (version) {
        case 1:
            let localConfigurationObsolete = false;
            const dataSources: LocalConfigurationData['dataSources'] = dataOnDisk.dataSources.map((ds, idx) => {
                const { dataSource, obsolete } = deserializeDataSourceSpecification(
                    ds.spec,
                    `data source in ${dataName} at position ${idx}`
                );
                if (obsolete) {
                    localConfigurationObsolete = true;
                }
                const savedSearches: LocalConfigurationData['dataSources'][number]['savedSearches'] = ds.savedSearches.map((ss, idxSS) => {
                    const { savedSearch, obsolete } = deserializeSavedSearch(
                        ss,
                        `saved search in ${dataName} at position ${idx}, ${idxSS}`
                    );
                    if (obsolete) {
                        localConfigurationObsolete = true;
                    }
                    return savedSearch;
                });
                return {
                    spec: dataSource,
                    savedSearches,
                };
            });
            return {
                localConfiguration: {
                    currentDataSourceId: dataOnDisk.state.currentDataSourceId,
                    dataSources,
                    dataSourcesSets: data.dataSourcesSets,
                },
                obsolete: localConfigurationObsolete,
            };
        default:
            const exhaustiveCheck: never = version;
            throw new Error(`Unhandled dataOnDisk.v: ${exhaustiveCheck}`);
    }
}
