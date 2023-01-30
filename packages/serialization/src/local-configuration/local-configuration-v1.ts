import { Static, Type } from '@sinclair/typebox';

export const SerializedLocalConfigurationDataV1Schema = Type.Object({
    v: Type.Literal(1),
    state: Type.Object({
        currentDataSourceId: Type.Object({
            dataSourceSetId: Type.String(),
            dataSourceId: Type.String(),
        }),
    }),
    dataSources: Type.Array(
        Type.Object({
            spec: Type.Any(),
            savedSearches: Type.Array(Type.Any()),
        })
    ),
    dataSourcesSets: Type.Array(
        Type.Object({
            id: Type.String(),
            name: Type.String(),
            spec: Type.Union([
                Type.Object({
                    type: Type.Literal('local'),
                }),
                Type.Object({
                    type: Type.Literal('AWSS3'),
                    region: Type.String(),
                    bucket: Type.String(),
                    prefix: Type.String(),
                }),
            ]),
        })
    ),
});
export type SerializedLocalConfigurationDataV1 = Static<typeof SerializedLocalConfigurationDataV1Schema>;
