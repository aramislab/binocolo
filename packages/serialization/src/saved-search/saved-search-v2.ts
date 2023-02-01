import { Static, Type } from '@sinclair/typebox';

const JSONBasicTypeSchema = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]);

export const SavedSearchOnDiskV2Schema = Type.Object({
    v: Type.Literal(2),
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
            histogramBreakdownProperty: Type.Union([Type.String(), Type.Null()]),
        }),
    }),
});
export type SavedSearchOnDiskV2 = Static<typeof SavedSearchOnDiskV2Schema>;
