import { Static, Type } from '@sinclair/typebox';

// Documentation:
// - https://www.npmjs.com/package/@sinclair/typebox

export const InputLogEntrySchema = Type.Object({
    id: Type.String(),
    ts: Type.Number(),
    payload: Type.Any(),
});
export type InputLogEntry = Static<typeof InputLogEntrySchema>;
