import { Static, Type } from '@sinclair/typebox';

const JSONBasicTypeSchema = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]);

export const SerializedDataSourceSpecificationsV1Schema = Type.Object({
    v: Type.Literal(1),
    dataSource: Type.Object({
        id: Type.String(),
        name: Type.String(),
        adapter: Type.Union([
            Type.Object({
                type: Type.Literal('AWSCloudWatch'),
                region: Type.String(),
                logGroupNames: Type.Array(Type.String()),
            }),
        ]),
        knownProperties: Type.Array(
            Type.Object({
                selector: Type.String(),
                name: Type.Optional(Type.String()),
                width: Type.Optional(Type.Number()),
                grow: Type.Optional(Type.Boolean()),
                timestamp: Type.Optional(Type.Boolean()),
                distinctColorsForValues: Type.Optional(Type.Boolean()),
                knownValues: Type.Optional(
                    Type.Array(
                        Type.Object({
                            value: JSONBasicTypeSchema,
                            color: Type.Optional(Type.Union([Type.Literal('error'), Type.Literal('warning'), Type.Literal('normal')])),
                        })
                    )
                ),
            })
        ),
    }),
});
export type SerializedDataSourceSpecificationsV1 = Static<typeof SerializedDataSourceSpecificationsV1Schema>;
