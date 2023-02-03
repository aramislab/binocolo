import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { REFERENCE_TEXT_SIZE, ProcessedLogEntry, LINE_HEIGHT, PropertyData, LogCellData } from '../logic/types.js';
import { makeStringFromJSONFieldSelector, JSONFieldSelector } from '@binocolo/common/common.js';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration, TABLE_COLUMNS_GAP, TABLE_PADDING } from '../logic/models.js';
import { useDOMElementShape } from '../hooks/dom_element_shape.js';
import { PopupMenuFactory } from './PopupMenu.js';
import { TextBlock } from './TextBlock.js';
import styled from 'styled-components';
import debounce from 'lodash.debounce';
import { PropertyHeaderView } from './PropertyHeaderView.js';
import { PropertyHeaderTitle } from './PropertyHeaderTitle.js';
import { DetailPayload, propertyValuePopupFactory } from './DetailPayload.js';

type LogEntriesTableParams = {
    style?: React.CSSProperties;
    config: LogTableConfiguration;
};

const sum = (a: number, b: number) => a + b;
const compareNumbers = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

export const LogEntriesTable = observer(({ config, style }: LogEntriesTableParams) => {
    const [expandedEntries, setExpandedEntries] = React.useState<Map<number, ProcessedLogEntry>>(new Map());
    const setEntryExpanded = (idx: number, entry: ProcessedLogEntry, expanded: boolean) => {
        if (expanded) {
            setExpandedEntries(new Map(expandedEntries.set(idx, entry)));
        } else {
            expandedEntries.delete(idx);
            setExpandedEntries(new Map(expandedEntries));
        }
    };

    const domRef = React.useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = React.useState<number | null>(null);
    useDOMElementShape(domRef, 300, (size) => {
        config.setTableWidth(size.width);
        setHeight(size.height);
    });
    const [scrollPosition, setScrollPosition] = React.useState<number>(0);
    React.useEffect(() => {
        function updatePosition() {
            if (domRef.current) {
                setScrollPosition(domRef.current.scrollTop);
            }
        }
        const updatePositionDebounced = debounce(updatePosition, 200, { maxWait: 200 });
        let node: HTMLDivElement;
        if (domRef.current) {
            node = domRef.current;
            node.addEventListener('scroll', updatePositionDebounced);
            updatePosition();
        }
        return () => {
            node && node.removeEventListener('scroll', updatePositionDebounced);
        };
    });
    const lineHeight = REFERENCE_TEXT_SIZE * LINE_HEIGHT * config.zoom;
    const totalHeight =
        (config.entriesSelection.entries.length +
            Array.from(expandedEntries.values())
                .map((entry) => entry.payloadIntrospection.numLines)
                .reduce(sum, 0)) *
        lineHeight;
    let firstLineIdxDisplayed = Math.floor(scrollPosition / lineHeight);
    let expandedEntryIdxes: number[] = Array.from(expandedEntries.keys());
    expandedEntryIdxes.sort(compareNumbers);
    let numHiddenRows = firstLineIdxDisplayed;
    while (expandedEntryIdxes.length > 0 && expandedEntryIdxes[0] < firstLineIdxDisplayed) {
        const idx = expandedEntryIdxes.shift()!;
        const detailNumLines = expandedEntries.get(idx)!.payloadIntrospection.numLines + 1;
        if (idx + detailNumLines < firstLineIdxDisplayed) {
            firstLineIdxDisplayed -= detailNumLines;
        } else {
            numHiddenRows -= firstLineIdxDisplayed - idx;
            firstLineIdxDisplayed = idx;
        }
    }
    const numShownRows = height !== null ? Math.ceil(height / lineHeight) : 0;
    return (
        <LogEntriesTableContainer style={style} config={config}>
            <div
                className="LogEntriesTableHeader"
                style={{
                    gridTemplateColumns: config.gridTemplateColumns,
                    padding: TABLE_PADDING,
                    paddingBottom: 5,
                    columnGap: TABLE_COLUMNS_GAP * config.zoom,
                }}
            >
                <HeaderRow config={config} />
            </div>
            <div ref={domRef} className="LogEntriesTable">
                <div className="content" style={{ height: totalHeight }}>
                    <div style={{ height: numHiddenRows * lineHeight }} />
                    {sliceInMiddle(config.entriesSelection.entries, firstLineIdxDisplayed, numShownRows).map(({ element: entry, idx }) => (
                        <LogEntryRow
                            key={entry.id}
                            entry={entry}
                            entryNum={idx + 1}
                            config={config}
                            expanded={expandedEntries.has(idx)}
                            setExpanded={(expanded) => {
                                setEntryExpanded(idx, entry, expanded);
                            }}
                        />
                    ))}
                </div>
            </div>
        </LogEntriesTableContainer>
    );
});

function sliceInMiddle<T>(elements: T[], firstIdx: number, numElements: number): { element: T; idx: number }[] {
    return elements.slice(firstIdx, firstIdx + numElements).map((element, idx) => ({
        element,
        idx: firstIdx + idx,
    }));
}

const LogEntriesTableContainer = styled.div<{ readonly config: LogTableConfiguration }>`
    background-color: #000000;
    color: #c7c7c7;
    overflow: hidden;

    text-align: left;

    display: flex;
    flex-direction: column;

    > .LogEntriesTableHeader {
        display: grid;
        row-gap: 0;
        background-color: #252424;
        grid-template-columns: ${(props) => props.config.gridTemplateColumns};
        padding: ${TABLE_PADDING}px ${TABLE_PADDING}px 0 ${TABLE_PADDING}px;
        column-gap: ${(props) => TABLE_COLUMNS_GAP * props.config.zoom}px;
    }

    > .LogEntriesTable {
        flex-grow: 1;

        overflow: scroll;
        > .content {
            display: grid;
            row-gap: 0;
            align-content: start;
            grid-template-columns: ${(props) => props.config.gridTemplateColumns};
            padding: 0 ${TABLE_PADDING}px ${TABLE_PADDING}px ${TABLE_PADDING}px;
            column-gap: ${(props) => TABLE_COLUMNS_GAP * props.config.zoom}px;
        }
    }

    .RowNumberCell {
        user-select: none;
        grid-column: 1;
    }

    .toned-down {
        color: #797878;
    }

    .PropertyValueCell {
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

type HeaderParams = {
    config: LogTableConfiguration;
};

const HeaderRow = observer(({ config }: HeaderParams) => {
    return (
        <>
            {config.propertiesData.map(({ selector, name, column }) => (
                <TextBlock
                    key={makeStringFromJSONFieldSelector(selector)}
                    className="PropertyValueCell"
                    style={{ gridColumn: column, fontWeight: 'bold' }}
                    config={config}
                    theme={config.colorTheme.dark}
                    numLines={1}
                    popup={propertyFieldPopupFactory({ config, selector })}
                >
                    {name}
                </TextBlock>
            ))}
        </>
    );
});

const propertyFieldPopupFactory =
    ({ config, selector }: { config: LogTableConfiguration; selector: JSONFieldSelector }): PopupMenuFactory =>
    ({ close }) => {
        // const canToggleVisibility = config.canToggleVisibility(selector);
        // const columnShown = config.isPropertyShown(selector);
        return {
            title: <PropertyHeaderTitle config={config} selector={selector} />,
            component: () => (
                <ContentsDiv>
                    <PropertyHeaderView config={config} selector={selector} close={close} />
                </ContentsDiv>
            ),
        };
    };

const ContentsDiv = styled.div`
    padding: 5px;
`;

type LogEntryRowParams = {
    entry: ProcessedLogEntry;
    entryNum: number;
    config: LogTableConfiguration;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
};

const LogEntryRow = observer(({ entry, entryNum, config, expanded, setExpanded }: LogEntryRowParams) => {
    function onClickExpand() {
        setExpanded(!expanded);
    }
    let detailComponent: React.ReactNode = null;
    let detailHeight: number | undefined = undefined;
    if (expanded) {
        // const data = inspectPayload(entry.payload);
        detailHeight = REFERENCE_TEXT_SIZE * LINE_HEIGHT * config.zoom * entry.payloadIntrospection.numLines;
        detailComponent = (
            <DetailCell entry={entry} config={config} height={detailHeight}>
                <DetailPayload data={entry.payloadIntrospection} config={config} />
            </DetailCell>
        );
    }
    let rowNumLines: number = 1;
    const cells = config.propertiesData.map((propertyData) => {
        const cellData = config.getEntryCellData(entry, propertyData);
        rowNumLines = Math.max(cellData.numLines, rowNumLines);
        return { propertyData, cellData };
    });
    return (
        <>
            <TextBlock
                className="RowNumberCell toned-down"
                onClick={onClickExpand}
                config={config}
                numLines={rowNumLines}
                theme={config.colorTheme.dark}
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'start' }}
            >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexGrow: 1 }}>
                    {entryNum}
                    <ExpandIcon expanded={expanded} />
                </div>
            </TextBlock>
            {cells.map(({ propertyData, cellData }) => (
                <PropertyValueCell
                    key={makeStringFromJSONFieldSelector(propertyData.selector)}
                    cellData={cellData}
                    propertyData={propertyData}
                    config={config}
                />
            ))}
            {detailComponent}
        </>
    );
});

const ExpandIcon = ({ expanded }: { expanded: boolean }) => {
    return <FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} size={'xs'} />;
};

const PropertyValueCell = observer(
    ({
        propertyData,
        cellData: { numLines, value, wholeValue },
        config,
    }: {
        propertyData: PropertyData;
        cellData: LogCellData;
        config: LogTableConfiguration;
    }) => {
        const color = value ? propertyData.getColor(value) : null;
        return (
            <TextBlock
                className={`PropertyValueCell ${propertyData.tonedDown ? 'toned-down' : 'normal'}`}
                style={{ gridColumn: propertyData.column, color: color || undefined }}
                config={config}
                popup={propertyValuePopupFactory({ config, selector: propertyData.selector, value: wholeValue })}
                theme={config.colorTheme.dark}
                numLines={numLines}
            >
                {typeof value === 'string' ? (
                    value
                ) : value === null ? (
                    config.nullVisible ? (
                        <NullSpan color={config.colorTheme.dark.dimmedText}>&lt;null&gt;</NullSpan>
                    ) : (
                        ''
                    )
                ) : (
                    JSON.stringify(value)
                )}
            </TextBlock>
        );
    }
);

const NullSpan = styled.span<{ readonly color: string }>`
    font-style: italic;
    color: ${(props) => props.color};
`;

const DetailCell = observer(
    React.forwardRef<
        HTMLDivElement | null,
        {
            entry: ProcessedLogEntry;
            height: number;
            config: LogTableConfiguration;
            // inView: boolean;
            children: React.ReactNode;
        }
    >(({ height, entry, config, children }, ref) => {
        const { columnStart, columnEnd } = config.getDetailColumns();
        return (
            <DetailCellDiv
                ref={ref}
                config={config}
                className="DetailCell"
                height={height}
                gridColumnStart={columnStart}
                gridColumnEnd={columnEnd}
            >
                {children}
            </DetailCellDiv>
        );
    })
);

const DetailCellDiv = styled.div<{
    readonly config: LogTableConfiguration;
    height: number;
    readonly gridColumnStart: number;
    readonly gridColumnEnd: number;
}>`
    overflow: visible;
    background-color: ${(props) => props.config.colorTheme.propertyInspectBackground};
    display: flex;
    height: ${(props) => props.height}px;
    min-height: ${(props) => props.height}px;
    max-height: ${(props) => props.height}px;
    padding: ${(props) => (props.config.zoom * REFERENCE_TEXT_SIZE * LINE_HEIGHT) / 2}px;
    grid-column-start: ${(props) => props.gridColumnStart};
    grid-column-end: ${(props) => props.gridColumnEnd};

    .DetailObject {
        display: grid;
        row-gap: 0;
        border-left: 1px dotted gray;
        grid-template-columns: min-content auto;
        overflow: hidden;
        overflow-x: scroll;
    }

    .DetailArray {
        display: flex;
        flex-direction: column;
    }

    .object-key {
        color: #9b8b62;
    }

    .object-key:hover + .object-value {
        background-color: #262626;
    }

    .ShowPropertyIcon {
        /*position: relative;*/
        cursor: pointer;
    }

    .object-key .HiddenPropertyIcon svg {
        color: transparent;
    }

    .object-key:hover .HiddenPropertyIcon svg {
        color: #83ccd9;
    }
`;
