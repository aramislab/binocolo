import { JSONBasicType, JSONBasicTypeName, JSONFieldSelector, makeStringFromJSONFieldSelector } from '@binocolo/common/common.js';
import { ArrayIntrospection, BasicTypeIntrospection, ObjectIntrospection, PayloadIntrospection, PropertyNode } from './types.js';

export function inspectPayload(payload: any, onLeafValue?: LeafValueCallback): PayloadIntrospection {
    return _inspectPayload(payload, [{ type: 'root' }], onLeafValue || null);
}

export function getJSONObjectType(payload: any): 'object' | 'array' | 'basic' | 'undefined' {
    if (payload === undefined) {
        return 'undefined';
    } else if (payload === null || typeof payload === 'string' || typeof payload === 'boolean' || typeof payload === 'number') {
        return 'basic';
    } else if (Array.isArray(payload)) {
        return 'array';
    } else {
        return 'object';
    }
}

export function isJSONBasicType(obj: any): obj is JSONBasicType {
    return getJSONObjectType(obj) === 'basic';
}

type LeafValueCallback = (selector: JSONFieldSelector, value: JSONBasicType) => void;

function _inspectPayload(payload: any, selector: JSONFieldSelector, onLeafValue: LeafValueCallback | null): PayloadIntrospection {
    const typeName = getJSONObjectType(payload);
    switch (typeName) {
        case 'array':
            return inspectArray(payload, selector, onLeafValue);
        case 'basic':
            return inspectBasicType(payload, selector, onLeafValue);
        case 'object':
            return inspectObject(payload, selector, onLeafValue);
        case 'undefined':
            throw new Error('Unexpected undefined value');
        default:
            const exhaustiveCheck: never = typeName;
            throw new Error(`Unhandled typeName: ${exhaustiveCheck}`);
    }
}

export function inspectArray(elements: any[], selector: JSONFieldSelector, onLeafValue: LeafValueCallback | null): ArrayIntrospection {
    const inspectedElements = elements.map((element, idx) =>
        _inspectPayload(element, selector.concat({ type: 'item', index: idx }), onLeafValue)
    );
    return {
        type: 'array',
        selector,
        elements: inspectedElements,
        numLines: Math.max(
            1,
            inspectedElements.reduce((sum, b) => sum + b.numLines, 0)
        ),
    };
}

export function inspectObject(obj: any, selector: JSONFieldSelector, onLeafValue: LeafValueCallback | null): ObjectIntrospection {
    let keys = Object.keys(obj);
    keys.sort();
    const inspectedElements = keys.map((name) => ({
        name,
        value: _inspectPayload(obj[name], selector.concat([{ type: 'property', name }]), onLeafValue),
    }));
    return {
        type: 'object',
        selector,
        elements: inspectedElements,
        numLines: Math.max(
            1,
            inspectedElements.reduce((sum, b) => sum + b.value.numLines, 0)
        ),
    };
}

export function inspectBasicType(obj: any, selector: JSONFieldSelector, onLeafValue: LeafValueCallback | null): BasicTypeIntrospection {
    onLeafValue && isJSONBasicType(obj) && onLeafValue(selector, obj);
    return {
        type: getJSONBasicTypeOf(obj),
        selector,
        value: obj,
        numLines: 1,
    };
}

export function getJSONBasicTypeOf(obj: any): JSONBasicTypeName {
    const objType = getJSONObjectType(obj);
    if (objType !== 'basic') {
        throw new Error(`Expected basic JSON type, instead found ${objType}`);
    }
    return (obj === null ? 'null' : typeof obj) as JSONBasicTypeName;
}

export const makeEmptyPropertyNode = (selector: JSONFieldSelector): PropertyNode => ({
    selector,
    leafTypes: new Set(),
    children: new Map(),
    size: 0,
});

export function visitPayload(payload: PayloadIntrospection, node: PropertyNode, onLeafValue?: LeafValueCallback): void {
    const type = payload.type;
    switch (type) {
        case 'object':
            for (let element of payload.elements) {
                let childNode: PropertyNode | undefined = node.children.get(element.name);
                if (!childNode) {
                    childNode = makeEmptyPropertyNode(element.value.selector);
                    node.children.set(element.name, childNode);
                }
                visitPayload(element.value, childNode, onLeafValue);
            }
            break;
        case 'array':
            node.leafTypes.add(payload.type);
            break;
        case 'string':
            node.leafTypes.add(payload.type);
            onLeafValue && onLeafValue(payload.selector, payload.value);
            break;
        case 'number':
            node.leafTypes.add(payload.type);
            onLeafValue && onLeafValue(payload.selector, payload.value);
            break;
        case 'boolean':
            node.leafTypes.add(payload.type);
            onLeafValue && onLeafValue(payload.selector, payload.value);
            break;
        case 'null':
            node.leafTypes.add(payload.type);
            onLeafValue && onLeafValue(payload.selector, payload.value);
            break;
        default:
            const exhaustiveCheck: never = type;
            throw new Error(`Unhandled payload.type: ${exhaustiveCheck}`);
    }
}

export function calculatePropertyNodeSize(node: PropertyNode): void {
    let total = node.leafTypes.size > 0 ? 1 : 0;
    for (let childNode of node.children.values()) {
        calculatePropertyNodeSize(childNode);
        total += childNode.size;
    }
    node.size = total;
}

export function searchPropertyNode(node: PropertyNode, search: string, selected: Set<string>): PropertyNode | null {
    if (search.length === 0) {
        return node;
    }
    const selectorText = makeStringFromJSONFieldSelector(node.selector);
    if (selected.has(selectorText)) {
        return node;
    }
    if (node.children.size === 0) {
        if (selectorText.toLowerCase().includes(search.toLowerCase())) {
            return node;
        } else {
            return null;
        }
    }
    const children: Map<string, PropertyNode> = new Map();
    let total = node.leafTypes.size > 0 ? 1 : 0;
    for (let [name, childNode] of node.children.entries()) {
        const visitedChild = searchPropertyNode(childNode, search, selected);
        if (visitedChild) {
            children.set(name, visitedChild);
            total += childNode.size;
        }
    }
    if (children.size === 0) {
        return null;
    }
    return {
        leafTypes: node.leafTypes,
        selector: node.selector,
        size: total,
        children,
    };
}
