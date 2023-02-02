import { Static, Type } from '@sinclair/typebox';

export const SerializedLocalConfigurationDataV2Schema = Type.Object({
    v: Type.Literal(2),
    state: Type.Object({
        currentUIState: Type.Union([
            Type.Object({
                type: Type.Literal('pristineDataSource'),
                dataSourceId: Type.String(),
            }),
            Type.Object({
                type: Type.Literal('savedSearchSelected'),
                dataSourceId: Type.String(),
                savedSearchId: Type.String(),
            }),
            Type.Object({
                type: Type.Literal('searchesDashboard'),
                dataSourceId: Type.String(),
            }),
        ]),
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
export type SerializedLocalConfigurationDataV2 = Static<typeof SerializedLocalConfigurationDataV2Schema>;
