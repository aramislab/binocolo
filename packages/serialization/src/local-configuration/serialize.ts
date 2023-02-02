import { validateJson } from '@binocolo/backend/json-validation.js';
import { LocalConfigurationData } from '../types.js';
import { SerializedLocalConfigurationData, SerializedLocalConfigurationDataSchema } from './types.js';
import { deserializeDataSourceSpecification, serializeDataSourceSpecification } from '../data-source/serialize.js';
import { serializeSavedSearch, deserializeSavedSearch } from '../saved-search/serialize.js';

export function serializeLocalConfuration(data: LocalConfigurationData): SerializedLocalConfigurationData {
    const serializedLocalConfiguration: SerializedLocalConfigurationData = {
        v: 2,
        state: {
            currentUIState: data.currentUIState,
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
    let dataSourcesObsolete: boolean = false;
    const dataSources: LocalConfigurationData['dataSources'] = dataOnDisk.dataSources.map((ds, idx) => {
        const { dataSource, obsolete } = deserializeDataSourceSpecification(ds.spec, `data source in ${dataName} at position ${idx}`);
        if (obsolete) {
            dataSourcesObsolete = true;
        }
        const savedSearches: LocalConfigurationData['dataSources'][number]['savedSearches'] = ds.savedSearches.map((ss, idxSS) => {
            const { savedSearch, obsolete } = deserializeSavedSearch(ss, `saved search in ${dataName} at position ${idx}, ${idxSS}`);
            if (obsolete) {
                dataSourcesObsolete = true;
            }
            return savedSearch;
        });
        return {
            spec: dataSource,
            savedSearches,
        };
    });

    const version = dataOnDisk.v;
    switch (version) {
        case 1:
            return {
                localConfiguration: {
                    currentUIState: dataOnDisk.state.currentSavedSearchId
                        ? {
                              type: 'savedSearchSelected',
                              dataSourceId: `${dataOnDisk.state.currentDataSourceId?.dataSourceSetId}:${dataOnDisk.state.currentDataSourceId?.dataSourceId}`,
                              savedSearchId: dataOnDisk.state.currentSavedSearchId,
                          }
                        : {
                              type: 'pristineDataSource',
                              dataSourceId: `${dataOnDisk.state.currentDataSourceId?.dataSourceSetId}:${dataOnDisk.state.currentDataSourceId?.dataSourceId}`,
                          },
                    dataSources,
                    dataSourcesSets: data.dataSourcesSets,
                },
                obsolete: true,
            };
        case 2:
            return {
                localConfiguration: {
                    currentUIState: dataOnDisk.state.currentUIState,
                    dataSources,
                    dataSourcesSets: data.dataSourcesSets,
                },
                obsolete: dataSourcesObsolete,
            };
        default:
            const exhaustiveCheck: never = version;
            throw new Error(`Unhandled dataOnDisk.v: ${exhaustiveCheck}`);
    }
}
