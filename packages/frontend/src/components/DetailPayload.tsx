import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faAdd, faMinus, faShare } from '@fortawesome/free-solid-svg-icons';
import {
    PayloadIntrospection,
    ObjectIntrospection,
    ObjectEntryIntrospection,
    ArrayIntrospection,
    BasicTypeIntrospection,
} from '../logic/types.js';
import {
    JSONType,
    isJSONBasicType,
    makeStringFromJSONFieldSelector,
    JSONFieldSelector,
    MatchDataSourceFilter,
} from '@binocolo/common/common.js';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import { PopupMenuFactory } from './PopupMenu.js';
import { TextBlock } from './TextBlock.js';
import styled from 'styled-components';
import { JSONBasicValueTextBlock } from './JSONBasicValueTextBlock.js';
import { IconButton } from './IconButton.js';
import { JSONBasicType } from '@binocolo/common/common.js';

export const DetailPayload = observer(
    ({
        data,
        config,
        style,
        className,
    }: {
        data: PayloadIntrospection;
        className?: string;
        config: LogTableConfiguration;
        style?: React.CSSProperties;
    }) => {
        return (
            <>
                {data.type === 'object' ? (
                    <DetailObject className={className} data={data} config={config} style={style} />
                ) : data.type === 'array' ? (
                    <DetailArray className={className} data={data} config={config} style={style} />
                ) : (
                    <DetailBasic className={className} data={data} config={config} style={style} />
                )}
            </>
        );
    }
);

const DetailObject = observer(
    ({
        data,
        config,
        style,
        className,
    }: {
        data: ObjectIntrospection;
        config: LogTableConfiguration;
        style?: React.CSSProperties;
        className?: string;
    }) => {
        return (
            <div
                style={{
                    ...style,
                    paddingLeft: 5,
                    columnGap: 10 * config.zoom,
                    gridColumnGap: 5 * config.zoom,
                }}
                className={`DetailObject ${className || ''}`}
            >
                {getObjectIntrospectionChildren(data).map((element) => (
                    <DetailObjectEntry key={element.name} element={element} config={config} />
                ))}
            </div>
        );
    }
);

function cmpObjectEntryIntrospection(
    { name: nameA, value: valueA }: ObjectEntryIntrospection,
    { name: nameB, value: valueB }: ObjectEntryIntrospection
): -1 | 0 | 1 {
    if (valueA.numLines < valueB.numLines) {
        return -1;
    } else if (valueA.numLines > valueB.numLines) {
        return 1;
    } else if (nameA < nameB) {
        return -1;
    } else if (nameA > nameB) {
        return 1;
    } else {
        return 0;
    }
}

function getObjectIntrospectionChildren(data: ObjectIntrospection): ObjectEntryIntrospection[] {
    let elements = Array.from(data.elements);
    elements.sort(cmpObjectEntryIntrospection);
    return elements;
}

const DetailObjectEntry = observer(({ element, config }: { element: ObjectEntryIntrospection; config: LogTableConfiguration }) => {
    const shown = config.isPropertyShown(element.value.selector);
    const color = shown ? '#83ccd9' : undefined;
    return (
        <>
            <TextBlock
                className="object-key"
                style={{
                    display: 'inline-flex',
                    flexDirection: 'row',
                    color,
                    justifyContent: 'space-between',
                }}
                config={config}
                theme={config.colorTheme.dark}
                numLines={1}
            >
                {element.name}
                {': '}
                {config.canToggleVisibility(element.value.selector) && (
                    <span
                        className={`ShowPropertyIcon ${shown ? '' : 'HiddenPropertyIcon'}`}
                        style={{
                            width: 18 * config.zoom,
                            marginLeft: 5 * config.zoom,
                            top: config.zoom,
                        }}
                        onClick={() => {
                            config.togglePropertyVisibility(element.value.selector);
                        }}
                    >
                        <FontAwesomeIcon icon={faEye} size={'xs'} className="ExpandIcon" />
                    </span>
                )}
            </TextBlock>
            <DetailPayload data={element.value} config={config} style={{ gridColumn: 2 }} className="object-value" />
        </>
    );
});

const DetailArray = observer(
    ({
        data,
        config,
        style,
        className,
    }: {
        data: ArrayIntrospection;
        config: LogTableConfiguration;
        style?: React.CSSProperties;
        className?: string;
    }) => {
        return (
            <div className={`DetailArray ${className || ''}`} style={{ ...style }}>
                {data.elements.map((element) => (
                    <DetailPayload key={makeStringFromJSONFieldSelector(element.selector)} data={element} config={config} />
                ))}
            </div>
        );
    }
);

const DetailBasic = observer(
    ({
        data,
        config,
        style,
        className,
    }: {
        data: BasicTypeIntrospection;
        config: LogTableConfiguration;
        style?: React.CSSProperties;
        className?: string;
    }) => {
        return (
            <JSONBasicValueTextBlock
                className={className}
                style={style}
                value={data.value}
                dataType={data.type}
                popup={propertyValuePopupFactory({ config, selector: data.selector, value: data.value })}
                config={config}
                theme={config.colorTheme.dark}
            />
        );
    }
);

export const propertyValuePopupFactory =
    ({ config, selector, value }: { config: LogTableConfiguration; selector: JSONFieldSelector; value?: JSONType }): PopupMenuFactory =>
    () => {
        const selectorText = makeStringFromJSONFieldSelector(selector);
        const onClick = (include: boolean, value: JSONBasicType, selectedText: string | null) => () => {
            const filter: MatchDataSourceFilter = {
                type: 'match',
                selector: selectorText,
                include,
                exact: selectedText === null,
                values: [selectedText !== null ? selectedText : value],
            };
            config.addFilter(filter);
        };
        const onAccumulate = (value: JSONBasicType, selectedText: string | null) => () => {
            config.addValueToMatchSearchAccumulator(selectorText, selectedText === null, selectedText !== null ? selectedText : value);
        };
        return {
            title: makeStringFromJSONFieldSelector(selector),
            value,
            component: ({ getSelectedText }) =>
                isJSONBasicType(value) && (
                    <ValueOperationsDiv>
                        <IconButton config={config} icon={faAdd} onClick={onClick(true, value, getSelectedText())} />
                        <IconButton config={config} icon={faMinus} onClick={onClick(false, value, getSelectedText())} />
                        <div className="match-type">{getSelectedText() === null ? 'Exact match' : 'Substring match'}</div>
                        {config.canAddValueToMatchSearchAccumulator(selectorText, getSelectedText() === null) && (
                            <div className="right">
                                <IconButton config={config} icon={faShare} onClick={onAccumulate(value, getSelectedText())} />
                            </div>
                        )}
                    </ValueOperationsDiv>
                ),
        };
    };

const ValueOperationsDiv = styled.div`
    margin: 5px 8px 10px 8px;
    display: flex;
    justify-content: start;
    align-items: center;

    .match-type {
        margin-left: 10px;
    }

    .right {
        flex-grow: 1;
        display: flex;
        justify-content: end;
    }
`;
