import React from 'react';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { MONOSPACE_FONT, SERIF_FONT } from '../logic/types.js';
import { RegionColorTheme } from '../logic/themes.js';
import { TextBlock } from './TextBlock.js';
import { TIME_RANGE_SPECIFIERS, TimeRangeSpecifierIds } from '@binocolo/common/common.js';
import { TimeRange } from '@binocolo/common/types.js';

export const DataSourceConfiguration = observer(({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    const [timeRangeSelection, setTimeRangeSelection] = React.useState<TimeRangeChoice>('current');
    const theme = config.colorTheme.light;
    const changesInDataSource = timeRangeSelection !== 'current' || config.timeRangeEdited();
    function applyChanges() {
        let timeRange: TimeRange | null = null;
        if (timeRangeSelection === 'current' && config.timeRangeEdited()) {
            timeRange = config.elaboratedTimeRange.timeRange;
        } else if (timeRangeSelection !== 'current') {
            let durationInMs: number | null = null;
            for (let { kind, durationInMs: dMs } of TIME_RANGE_SPECIFIERS) {
                if (kind === timeRangeSelection.kind) {
                    durationInMs = dMs * timeRangeSelection.amount;
                    break;
                }
            }
            if (durationInMs !== null) {
                const end = new Date().getTime();
                const start = end - durationInMs;
                timeRange = { start, end };
            }
        }
        close();
        if (timeRange) {
            config.changeDataSourceConfiguration(timeRange);
        } else {
            config.loadEntriesFromDataSource();
        }
    }
    return (
        <>
            <DataSourceConfigurationContainer>
                {/*<Title config={config}>Time Range</Title>*/}
                <TimeRangesDiv>
                    <TimeRangeRowValue>
                        <RadioButton
                            theme={theme}
                            selected={timeRangeSelection === 'current'}
                            onClick={() => {
                                setTimeRangeSelection('current');
                            }}
                        >
                            Displayed Time Range
                        </RadioButton>
                    </TimeRangeRowValue>
                    {TIME_RANGE_SPECIFIERS.map(({ name, kind }) => (
                        <TimeRangeRow
                            key={kind}
                            selection={timeRangeSelection}
                            setSelection={setTimeRangeSelection}
                            title={name}
                            kind={kind}
                            values={config.timeRanges[kind]}
                            theme={theme}
                        />
                    ))}
                </TimeRangesDiv>
            </DataSourceConfigurationContainer>
            <ButtonDiv theme={theme}>
                <TextBlock config={config} theme={theme} button style={{ padding: '3px 8px' }} onClick={applyChanges}>
                    {changesInDataSource ? 'Apply Changes and Query Data Source' : 'Query Data Source Again'}
                </TextBlock>
            </ButtonDiv>
        </>
    );
});

const ButtonDiv = styled.div<{ theme: RegionColorTheme }>`
    border-top: 1px solid ${(props) => props.theme.text};
    padding: 10px 15px 10px 0;
    display: flex;
    justify-content: end;
    background-color: ${(props) => props.theme.background};
`;

type TimeRangeChoice = { kind: TimeRangeSpecifierIds; amount: number } | 'current';

const TimeRangeRow = ({
    title,
    values,
    theme,
    selection,
    setSelection,
    kind,
}: {
    title: string;
    kind: TimeRangeSpecifierIds;
    values: number[];
    theme: RegionColorTheme;
    selection: TimeRangeChoice;
    setSelection: (v: TimeRangeChoice) => void;
}) => {
    return (
        <>
            <TimeRangeRowTitle>{title}</TimeRangeRowTitle>
            <TimeRangeRowValue>
                {values.map((value) => (
                    <RadioButton
                        key={value}
                        theme={theme}
                        selected={selection !== 'current' && selection.kind === kind && selection.amount === value}
                        onClick={() => {
                            setSelection({ kind, amount: value });
                        }}
                    >
                        {value}
                    </RadioButton>
                ))}
            </TimeRangeRowValue>
        </>
    );
};

const DataSourceConfigurationContainer = styled.div`
    padding: 15px;
    font-family: ${SERIF_FONT};
    width: 400px;
`;

const TimeRangesDiv = styled.div`
    display: grid;
    grid-template-columns: 60px auto;
    margin-bottom: 10px;
`;

const TimeRangeRowTitle = styled.div`
    grid-column: 1;
    display: flex;
    align-items: center;
`;

const TimeRangeRowValue = styled.div`
    grid-column: 2;
    display: flex;
    flex-direction: row;
`;

const RadioButton = styled.div<{ readonly theme: RegionColorTheme; readonly selected?: boolean }>`
    padding: 5px 10px 4px 10px;
    border: 1px solid ${(props) => props.theme.lines};
    margin: 3px;
    border-radius: 3px;
    width: max-content;
    font-family: ${MONOSPACE_FONT};
    background-color: ${(props) => (props.selected ? props.theme.button : props.theme.lightBackground)};
    cursor: pointer;

    &:hover {
        background-color: ${(props) => props.theme.highlight};
    }
`;
