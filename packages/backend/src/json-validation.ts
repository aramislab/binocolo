import Ajv, { Schema } from 'ajv';

export function validateJson<T>(data: any, schema: Schema, dataName: string): T {
    const ajv = new Ajv();
    const valid = ajv.validate(schema, data);
    if (!valid) {
        const errors: string[] = ajv.errors ? ajv.errors.map((err) => err.message).filter(notEmpty) : [];
        throw new Error([`Failed validation of ${dataName}:`, ...errors].join('\n'));
    }
    return data;
}

type EmptyValue = null | undefined | false;

function notEmpty<TValue>(value: TValue | EmptyValue): value is TValue {
    return value !== null && value !== undefined && value !== false;
}
