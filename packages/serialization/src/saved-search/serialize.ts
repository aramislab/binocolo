import { validateJson } from '@binocolo/backend/json-validation.js';
import { SavedSearchOnDiskSchema, SavedSearchOnDisk } from './types.js';
import { NamedSearch } from '@binocolo/common/common.js';

export function serializeSavedSearch(search: NamedSearch): SavedSearchOnDisk {
    return {
        v: 1,
        search,
    };
}

export function deserializeSavedSearch(data: any, dataName: string): { savedSearch: NamedSearch; obsolete: boolean } {
    const dataOnDisk = validateJson<SavedSearchOnDisk>(data, SavedSearchOnDiskSchema, `saved search in ${dataName}`);
    const version = dataOnDisk.v;
    switch (version) {
        case 1:
            return {
                savedSearch: dataOnDisk.search,
                obsolete: false,
            };
        default:
            const exhaustiveCheck: never = version;
            throw new Error(`Unhandled dataOnDisk.v: ${exhaustiveCheck}`);
    }
}
