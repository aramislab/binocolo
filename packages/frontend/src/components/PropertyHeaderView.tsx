import React from 'react';
import chroma from 'chroma-js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAdd, faMinus, faCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { SERIF_FONT, MONOSPACE_FONT, makePercentage } from '../logic/types.js';
import { makeStringFromJSONFieldSelector, JSONFieldSelector, MatchDataSourceFilter } from '@binocolo/common/common.js';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import { MenuCommands } from './PopupMenu.js';
import { TextBlock } from './TextBlock.js';
import styled from 'styled-components';
import { JSONBasicValueTextBlock } from './JSONBasicValueTextBlock.js';
import { JSONBasicType } from '@binocolo/common/common.js';
import { IconButton } from './IconButton.js';

export const PropertyHeaderView = observer(
    ({ config, selector, close }: { config: LogTableConfiguration; selector: JSONFieldSelector; close?: () => void }) => {
        const [freeSearch, setFreeSearch] = React.useState<string>('');
        const [freeSearchExact, setFreeSearchExact] = React.useState<boolean>(false);
        const selectorText = makeStringFromJSONFieldSelector(selector);
        const valueStats = config.getPropertyValueStats(selector, 7);
        const makeAddMinusOperations = (values: JSONBasicType[], exact: boolean) => {
            const onClick = (include: boolean) => () => {
                const filter: MatchDataSourceFilter = {
                    type: 'match',
                    selector: selectorText,
                    include,
                    values,
                    exact,
                };
                config.changeOrAddFilter(
                    {
                        type: 'match',
                        selector: selectorText,
                        values,
                    },
                    filter
                );
            };
            return (
                <div className="operations">
                    <IconButton config={config} icon={faAdd} onClick={onClick(true)} />
                    <IconButton config={config} icon={faMinus} onClick={onClick(false)} />
                </div>
            );
        };
        return (
            <>
                {!config.currentSearch ||
                !config.currentSearch.histogramBreakdownProperty ||
                config.currentSearch.histogramBreakdownProperty !== selectorText ? (
                    <ActionsSectionDiv>
                        <TextBlock
                            config={config}
                            className="button"
                            theme={config.colorTheme.light}
                            button
                            onClick={() => {
                                close && close();
                                config.setHistogramBreakdownProperty(selector);
                            }}
                        >
                            Group by???
                        </TextBlock>
                    </ActionsSectionDiv>
                ) : undefined}
                <PropertyFieldPopupSectionDiv>Filter values:</PropertyFieldPopupSectionDiv>
                <MenuCommands
                    commands={config.getExistenceFilters(selector).map(({ title, onClick, condition }) => ({
                        onClick,
                        title,
                        icon: condition && <FontAwesomeIcon icon={faCheck} size={'1x'} />,
                    }))}
                    config={config}
                />
                {valueStats && (
                    <>
                        <PropertyFieldPopupSectionDiv>
                            Values: (
                            {config.resultsComplete() ? (
                                `${makePercentage(valueStats.total / config.entriesSelection.entries.length)} of rows`
                            ) : (
                                <>
                                    {makePercentage(valueStats.total / config.entriesSelection.entries.length)} of displayed rows
                                    {config.dataBundleStats
                                        ? `, ${makePercentage(
                                              valueStats.total / config.dataBundleStats.recordsMatched
                                          )} of total filtered rows`
                                        : ''}
                                    <ResultsCompleteWarningIcon config={config} style={{ marginLeft: 3 }} />
                                </>
                            )}
                            )
                        </PropertyFieldPopupSectionDiv>
                        <PropertyValueStatDiv config={config}>
                            {valueStats.frequencies.map(({ typeName, value, occurrences }) => (
                                <PropertyValueStatRowDiv
                                    key={`${value}`}
                                    percWidth={80}
                                    percHeight={18}
                                    perc={occurrences / valueStats.total}
                                    config={config}
                                >
                                    {makeAddMinusOperations([value], true)}
                                    <JSONBasicValueTextBlock
                                        className="value"
                                        config={config}
                                        theme={config.colorTheme.light}
                                        value={value}
                                        dataType={typeName}
                                    />
                                    <div className="number">{occurrences}</div>
                                    <div className="perc">
                                        <div className="percvalue-container">
                                            <div className="percvalue"></div>
                                        </div>
                                        <div className="number">{makePercentage(occurrences / valueStats.total)}</div>
                                    </div>
                                </PropertyValueStatRowDiv>
                            ))}
                            {valueStats.more.length > 0 && (
                                <div className="more otherValues">
                                    {'+ '}
                                    {valueStats.more.map(({ typeName, occurrences }, idx) => (
                                        <React.Fragment key={typeName}>
                                            {idx > 0 && ' and '}
                                            {occurrences} more{' '}
                                            <span className="typeName" style={{ color: config.colorTheme.types[typeName] }}>
                                                {typeName}
                                            </span>{' '}
                                            values
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                            {valueStats.all.map(({ typeName, occurrences, values }) => (
                                <PropertyValueStatRowDiv key={typeName} percWidth={80} percHeight={18} perc={1} config={config}>
                                    {makeAddMinusOperations(values, true)}
                                    <div className="otherValues">
                                        {`all ${occurrences} `}
                                        <span className="typeName" style={{ color: config.colorTheme.types[typeName] }}>
                                            {typeName}
                                        </span>{' '}
                                        values <ResultsCompleteWarningIcon config={config} style={{ marginLeft: 3 }} />
                                    </div>
                                </PropertyValueStatRowDiv>
                            ))}
                            <PropertyValueStatRowDiv percWidth={80} percHeight={18} perc={1} config={config}>
                                {freeSearch.length > 0 ? (
                                    makeAddMinusOperations([freeSearch], freeSearchExact)
                                ) : (
                                    <div className="operations"></div>
                                )}
                                <div className="customSearch">
                                    <input
                                        type="text"
                                        placeholder="enter custom value???"
                                        value={freeSearch}
                                        onChange={(evt) => {
                                            setFreeSearch(evt.target.value);
                                        }}
                                    ></input>
                                    {freeSearch.length > 0 && (
                                        <TextBlock
                                            className="exactButton"
                                            config={config}
                                            theme={config.colorTheme.light}
                                            numLines={1}
                                            button
                                            onClick={() => {
                                                setFreeSearchExact(!freeSearchExact);
                                            }}
                                        >
                                            {freeSearchExact ? 'exact' : 'substr'}
                                        </TextBlock>
                                    )}
                                </div>
                            </PropertyValueStatRowDiv>
                        </PropertyValueStatDiv>
                    </>
                )}
            </>
        );
    }
);

const ResultsCompleteWarningIcon = ({ config, style }: { config: LogTableConfiguration; style?: React.CSSProperties }) =>
    !config.resultsComplete() ? (
        <FontAwesomeIcon icon={faCircleExclamation} style={{ ...style, color: config.colorTheme.light.warning }} />
    ) : null;

const ActionsSectionDiv = styled.div`
    display: flex;
    justify-content: end;

    > .button {
        max-width: max-content;
        padding: 1px 6px;
    }
`;

const PropertyValueStatRowDiv = styled.div<{
    readonly perc: number;
    readonly percWidth: number;
    readonly percHeight: number;
    readonly config: LogTableConfiguration;
}>`
    display: grid;
    grid-template-columns: 50px 250px 50px ${(props) => props.percWidth}px;
    grid-column-gap: 5px;
    flex-direction: row;
    margin: 0 0 3px 0;
    padding: 0;
    align-items: center;

    > .operations {
        grid-column: 1;
        display: flex;
        justify-content: center;
        //align-items: center;
        align-self: start;
        > .button {
            padding: 1px 4px;
            margin-right: 3px;
        }
    }
    > .value {
        grid-column: 2;
        padding: 3px 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        background-color: ${(props) => props.config.colorTheme.dark.background};
        border-radius: 5px;
        max-width: max-content;
    }
    > .number {
        grid-column: 3;
        text-align: right;
    }
    > .perc {
        grid-column: 4;
        background-color: ${(props) => props.config.colorTheme.light.background};
        height: ${(props) => props.percHeight}px;
        font-family: ${MONOSPACE_FONT};
        display: flex;
        justify-content: start;
        align-items: center;
        border-radius: 5px;
        > .number {
            padding-left: 5px;
        }
        > .percvalue-container {
            width: 0;
            > .percvalue {
                position: relative;
                height: ${(props) => props.percHeight}px;
                width: ${(props) => props.perc * props.percWidth}px;
                background-color: ${(props) => chroma(props.config.colorTheme.light.text).alpha(0.4).hex()};
                border-top-left-radius: 5px;
                border-bottom-left-radius: 5px;
            }
        }
    }
`;

const PropertyValueStatDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    display: flex;
    flex-direction: column;
    align-items: start;
    > .more {
        margin: 3px 0 10px 55px;
    }
    .otherValues {
        display: flex;
        align-items: baseline;
    }
    .typeName {
        display: inline-block;
        padding: 3px 6px;
        margin: 0 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        background-color: ${(props) => props.config.colorTheme.dark.background};
        border-radius: 5px;
        max-width: max-content;
    }
    .customSearch {
        display: flex;
        align-items: center;
        input {
            outline: none;
            height: 18px;
            width: 200px;
            border-radius: 3px;
            border: 1px solid ${(props) => props.config.colorTheme.dark.lines};
            background-color: ${(props) => props.config.colorTheme.light.background};
        }
        .exactButton {
            margin-left: 5px;
            padding: 1px 5px;
            width: 50px;
            justify-content: center;
        }
    }
`;

const PropertyFieldPopupSectionDiv = styled.div`
    padding: 8px;
    font-family: ${SERIF_FONT};
`;
