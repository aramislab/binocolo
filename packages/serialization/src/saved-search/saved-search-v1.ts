import { Static, Type } from '@sinclair/typebox';

const JSONBasicTypeSchema = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]);

export const SavedSearchOnDiskV1Schema = Type.Object({
    v: Type.Literal(1),
    search: Type.Object({
        id: Type.String(),
        title: Type.String(),
        spec: Type.Object({
            filters: Type.Array(
                Type.Union([
                    Type.Object({
                        type: Type.Literal('match'),
                        include: Type.Boolean(),
                        selector: Type.String(),
                        values: Type.Array(JSONBasicTypeSchema),
                        exact: Type.Boolean(),
                    }),
                    Type.Object({
                        type: Type.Literal('exists'),
                        exists: Type.Boolean(),
                        considerNulls: Type.Boolean(),
                        selector: Type.String(),
                    }),
                ])
            ),
            shownProperties: Type.Array(Type.String()),
        }),
    }),
});
export type SavedSearchOnDiskV1 = Static<typeof SavedSearchOnDiskV1Schema>;
