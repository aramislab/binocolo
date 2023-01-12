import { LogTableConfiguration } from '../logic/models.js';
import { LINE_HEIGHT, MONOSPACE_FONT, PropertyNode, REFERENCE_TEXT_SIZE } from '../logic/types.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';
import React from 'react';
import { PropertyHeaderTitle, PropertyHeaderView } from './LogEntriesTable.js';
import { JSONFieldSelector, makeStringFromJSONFieldSelector, parseFieldSelectorText } from '@binocolo/common/common.js';
import { observer } from 'mobx-react-lite';
import { searchPropertyNode } from '../logic/inspect_payload.js';
import { faSquare, faSquareCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const FieldsPicker = ({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [search, setSearch] = React.useState<string>('');
    const [selector, setSelector] = React.useState<JSONFieldSelector | null>(null);
    const [selectedFields, setSelectedFields] = React.useState<Set<string>>(new Set());
    function selectField(selector: JSONFieldSelector | null) {
        if (selector) {
            const selectorText = makeStringFromJSONFieldSelector(selector);
            if (selectedFields.has(selectorText)) {
                selectedFields.delete(selectorText);
            } else {
                selectedFields.add(selectorText);
            }
            setSelectedFields(new Set(selectedFields));
        } else {
            setSelectedFields(new Set());
        }
        setSelector(null);
    }
    const filteredRootNode = searchPropertyNode(config.entriesSelection.rootPropertyNode, search, selectedFields);
    React.useEffect(() => {
        const el = inputRef.current;
        if (el) {
            el.focus();
        }
    });
    let leafNodes: PropertyNode[] = [];
    const visitedPropertyNodes: VisitedPropertyNode[] | null = filteredRootNode
        ? _visitPropertyNode(filteredRootNode, search, (node) => {
              leafNodes.push(node);
          })
        : null;
    const allSelected = selectedFields.size === leafNodes.length;
    const noneSelected = selectedFields.size === 0;
    function clickCompoundCheckbox() {
        if (allSelected) {
            setSelectedFields(new Set());
        } else {
            setSelectedFields(new Set(leafNodes.map((node) => makeStringFromJSONFieldSelector(node.selector))));
        }
        setSelector(null);
    }
    const compoundSelector: JSONFieldSelector | null =
        selectedFields.size > 1
            ? [
                  {
                      type: 'compound',
                      selectors: Array.from(selectedFields.values()).map(parseFieldSelectorText),
                  },
              ]
            : null;
    return (
        <FieldsPickerContainer config={config}>
            <div className="fields-and-search">
                <input
                    ref={inputRef}
                    type="text"
                    className="search"
                    value={search}
                    onChange={(evt) => {
                        setSearch(evt.target.value);
                    }}
                />
                <div className="fields-and-compound">
                    <div className="fields-and-checkboxes">
                        <div className="checkboxes">
                            {leafNodes.map((node) => (
                                <div
                                    key={makeStringFromJSONFieldSelector(node.selector)}
                                    className="checkbox"
                                    onClick={() => {
                                        selectField(node.selector);
                                    }}
                                >
                                    <FontAwesomeIcon
                                        className={`icon ${
                                            selectedFields.has(makeStringFromJSONFieldSelector(node.selector)) ? 'selected' : ''
                                        }`}
                                        icon={selectedFields.has(makeStringFromJSONFieldSelector(node.selector)) ? faSquareCheck : faSquare}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="fields">
                            {visitedPropertyNodes && (
                                <FieldNodeChildren
                                    rows={visitedPropertyNodes}
                                    config={config}
                                    close={close}
                                    selector={selector}
                                    setSelector={setSelector}
                                />
                            )}
                        </div>
                    </div>
                    {leafNodes.length > 0 && (
                        <div className="compound">
                            <div
                                className="checkbox"
                                onClick={() => {
                                    clickCompoundCheckbox();
                                }}
                            >
                                <FontAwesomeIcon
                                    className={`icon ${allSelected ? 'selected' : noneSelected ? '' : 'partial'}`}
                                    icon={noneSelected ? faSquare : faSquareCheck}
                                />
                            </div>
                            <div className="compound-text">
                                Select all
                                {compoundSelector && (
                                    <TextBlock
                                        className={`key leaf ${compoundSelector === selector ? 'selected' : ''}`}
                                        config={config}
                                        theme={config.colorTheme.dark}
                                        numLines={1}
                                        onClick={() => {
                                            setSelector(compoundSelector);
                                        }}
                                    >
                                        compound
                                    </TextBlock>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {selector && <DetailView config={config} selector={selector} />}
        </FieldsPickerContainer>
    );
};

const DetailView = observer(({ config, selector }: { config: LogTableConfiguration; selector: JSONFieldSelector }) => {
    return (
        <DetailViewDiv config={config}>
            <PropertyHeaderTitle config={config} selector={selector} className="header" />
            <div className="propertyView">
                <PropertyHeaderView config={config} selector={selector} />
            </div>
        </DetailViewDiv>
    );
});

const DetailViewDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    flex-direction: column;
    color: black;
    > .header {
        padding: 5px 10px;
        background-color: ${(props) => props.config.colorTheme.popup.header};
    }

    > .propertyView {
        padding: 10px;

        > .selector {
            background-color: ${(props) => props.config.colorTheme.dark.background};
            color: ${(props) => props.config.colorTheme.dark.text};
            padding: 1px 6px;
            border-radius: 3px;
            max-width: max-content;
            margin-bottom: 10px;
        }
    }
`;

const FieldsPickerContainer = styled.div<{ readonly config: LogTableConfiguration }>`
    color: ${(props) => props.config.colorTheme.dark.text};
    //padding: 5px;
    display: flex;
    flex-direction: row;

    > .fields-and-search {
        display: flex;
        flex-direction: column;

        > .search {
            background-color: ${(props) => props.config.colorTheme.light.background};
            border: 1px solid ${(props) => props.config.colorTheme.dark.background};
            border-radius: 2px;
            padding-left: 5px;
            font-family: ${MONOSPACE_FONT};
            font-size: ${REFERENCE_TEXT_SIZE * LINE_HEIGHT};
            outline: none;

            &:active {
                border: none;
            }
        }

        > .fields-and-compound {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            overflow: scroll;
            max-height: 500px;
            background-color: ${(props) => props.config.colorTheme.dark.background};

            .checkbox {
                padding: 1px 0 1px 0;
                height: ${REFERENCE_TEXT_SIZE * LINE_HEIGHT}px;
                cursor: pointer;
                &:hover {
                    > .icon {
                        color: ${(props) => props.config.colorTheme.dark.dimmedText};
                    }
                }
                > .icon {
                    color: ${(props) => props.config.colorTheme.dark.highlight};
                }
                > .icon.selected {
                    color: ${(props) => props.config.colorTheme.dark.text};
                }
                > .icon.partial {
                    color: ${(props) => props.config.colorTheme.dark.dimmedText};
                }
            }

            > .fields-and-checkboxes {
                display: flex;
                flex-direction: row;
                > .checkboxes {
                    padding: 8px 0 0 7px;
                }
                > .fields {
                    flex-grow: 1;
                    padding: 5px 10px 5px 5px;
                    min-width: 380px;
                    max-width: 380px;
                    width: 380px;
                }
            }

            > .compound {
                display: flex;
                flex-direction: row;
                padding: 8px 0 7px 7px;

                > .compound-text {
                    padding: 0 0 0 7px;
                }
            }
        }
    }
`;

const FieldNodeChildren = ({
    rows,
    config,
    close,
    selector,
    setSelector,
}: {
    rows: VisitedPropertyNode[];
    config: LogTableConfiguration;
    close: () => void;
    selector: JSONFieldSelector | null;
    setSelector: (selector: JSONFieldSelector) => void;
}) => {
    return (
        <FieldNodeDiv config={config}>
            {rows.map((row) => (
                <Row config={config} key={row.key}>
                    {row.type === 'leafTypes' ? (
                        <TextBlock
                            className={`key leaf ${row.node.selector === selector ? 'selected' : ''}`}
                            config={config}
                            theme={config.colorTheme.dark}
                            numLines={1}
                            onClick={() => {
                                setSelector(row.node.selector);
                            }}
                        >
                            <i>{Array.from(row.node.leafTypes.values()).join(', ')}</i>
                        </TextBlock>
                    ) : row.type === 'leafNode' ? (
                        <TextBlock
                            className={`key leaf ${row.subnode.selector === selector ? 'selected' : ''}`}
                            config={config}
                            theme={config.colorTheme.dark}
                            numLines={1}
                            onClick={() => {
                                setSelector(row.subnode.selector);
                            }}
                        >
                            {row.name}
                        </TextBlock>
                    ) : (
                        <>
                            <div className="key node">{row.name}.</div>
                            <FieldNodeChildren
                                rows={row.childrenRows}
                                config={config}
                                close={close}
                                selector={selector}
                                setSelector={setSelector}
                            />
                        </>
                    )}
                </Row>
            ))}
        </FieldNodeDiv>
    );
};

type VisitedPropertyNode =
    | { type: 'leafTypes'; key: string; node: PropertyNode }
    | { type: 'leafNode'; key: string; name: string; subnode: PropertyNode }
    | { type: 'subnode'; key: string; name: string; childrenRows: VisitedPropertyNode[] };

function _visitPropertyNode(node: PropertyNode, search: string, onLeafNode: (node: PropertyNode) => void): VisitedPropertyNode[] {
    let rows: VisitedPropertyNode[] = [];
    if (node.leafTypes.size > 0 && search.length === 0) {
        rows.push({
            type: 'leafTypes',
            key: 'leafTypes',
            node,
        });
        onLeafNode(node);
    }
    for (let { name, node: subnode } of getNodeChildren(node)) {
        if (subnode.children.size === 0) {
            rows.push({
                type: 'leafNode',
                key: name,
                name,
                subnode,
            });
            onLeafNode(subnode);
        } else {
            rows.push({
                type: 'subnode',
                key: name,
                name,
                childrenRows: _visitPropertyNode(subnode, search, onLeafNode),
            });
        }
    }
    return rows;
}

function cmpPropertyNodes<T extends [string, PropertyNode]>([nameA, nodeA]: T, [nameB, nodeB]: T): -1 | 0 | 1 {
    if (nodeA.leafTypes.size > 0 && nodeB.leafTypes.size === 0) {
        return -1;
    } else if (nodeA.leafTypes.size === 0 && nodeB.leafTypes.size > 0) {
        return 1;
    } else if (nodeA.size < nodeB.size) {
        return -1;
    } else if (nodeA.size > nodeB.size) {
        return 1;
    } else if (nameA < nameB) {
        return -1;
    } else if (nameA > nameB) {
        return 1;
    } else {
        return 0;
    }
}

function getNodeChildren(node: PropertyNode): { name: string; node: PropertyNode }[] {
    let children = Array.from(node.children.entries());
    children.sort(cmpPropertyNodes);
    return children.map(([name, node]) => ({ name, node }));
}

const FieldNodeDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    display: flex;
    flex-direction: column;
    overflow: scroll;
`;

const Row = styled.div<{ readonly config: LogTableConfiguration }>`
    display: flex;
    flex-direction: row;
    color: ${(props) => props.config.colorTheme.dark.text};
    align-items: stretch;

    > .key {
        background-color: ${(props) => props.config.colorTheme.dark.background};
        // background-color: ${(props) => props.config.colorTheme.propertyInspectBackground};
        padding: 1px 1px;
    }
    > .node {
        line-height: ${LINE_HEIGHT};
        color: ${(props) => props.config.colorTheme.dark.dimmedText};
    }
    > .leaf {
        border-radius: 3px;
        &:hover {
            background-color: ${(props) => props.config.colorTheme.dark.highlight};
        }
    }
    > .selected {
        background-color: ${(props) => props.config.colorTheme.dark.lightBackground};
        &:hover {
            background-color: ${(props) => props.config.colorTheme.dark.lightBackground};
        }
    }
`;
