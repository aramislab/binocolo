import { Static, Type } from '@sinclair/typebox';
import { SavedSearchOnDiskV1Schema } from './saved-search-v1.js';
import { SavedSearchOnDiskV2Schema } from './saved-search-v2.js';

export const SavedSearchOnDiskSchema = Type.Union([SavedSearchOnDiskV1Schema, SavedSearchOnDiskV2Schema]);
export type SavedSearchOnDisk = Static<typeof SavedSearchOnDiskSchema>;
