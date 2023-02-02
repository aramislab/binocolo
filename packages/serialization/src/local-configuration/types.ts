import { Static, Type } from '@sinclair/typebox';
import { SerializedLocalConfigurationDataV1Schema } from './local-configuration-v1.js';
import { SerializedLocalConfigurationDataV2Schema } from './local-configuration-v2.js';

export const SerializedLocalConfigurationDataSchema = Type.Union([
    SerializedLocalConfigurationDataV1Schema,
    SerializedLocalConfigurationDataV2Schema,
]);
export type SerializedLocalConfigurationData = Static<typeof SerializedLocalConfigurationDataSchema>;
