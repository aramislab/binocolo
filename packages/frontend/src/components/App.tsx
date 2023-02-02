import React from 'react';
import { LogEntriesTable } from './LogEntriesTable.js';
import { IApplicationState, LogTableConfiguration } from '../logic/models.js';
import { observer } from 'mobx-react-lite';
import { EventsChart } from './EventsChart.js';
import { TimeRangeControl } from './TimeRangeControl.js';
import { TextBlock } from './TextBlock.js';
import styled from 'styled-components';
import { RegionColorTheme } from '../logic/themes.js';
import { makeFilterDescription, makeFilterId } from '../logic/filters.js';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MONOSPACE_FONT, SERIF_FONT } from '../logic/types.js';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { SavedSearches } from './SavedSearches.js';
import { SearchTitle } from './SearchTitle.js';
import { millify } from 'millify';

const App = observer(({ state }: { state: IApplicationState }) => {
    if (state.terminated) {
        return <div className="App">Lost connection to the server.</div>;
    }
    if (!state.config) {
        return null;
    }
    if (state.config.serverError) {
        return <div className="App">Server-side error.</div>;
    }
    const theme = state.config.colorTheme.light;
    const config = state.config;
    const tzInfo = config.getTimezoneInfo();

    return (
        <AppDiv theme={theme}>
            <MainArea>
                <PageHeader theme={theme}>
                    <TimeRangeControl config={state.config} />
                </PageHeader>
                <SavedSearchSection>
                    <TextBlock
                        config={config}
                        className="savedSearchesButton"
                        theme={theme}
                        button
                        popup={({ close }) => ({
                            title: 'Saved Searches',
                            component: <SavedSearches config={config} close={close} />,
                        })}
                    >
                        <FontAwesomeIcon icon={faBars} size={'xs'} />
                    </TextBlock>
                    <SearchTitle config={config} className="title" />
                </SavedSearchSection>
                <FiltersSection theme={theme} config={config}>
                    {state.config.currentSearch.filters.map((filter) => (
                        <div key={makeFilterId(filter)} className="filter dataSourceFilter">
                            <div className="filter-text">{makeFilterDescription(filter)}</div>
                            <TextBlock
                                config={config}
                                className="button"
                                theme={theme}
                                button
                                onClick={() => {
                                    config.removeFilter(makeFilterId(filter));
                                }}
                            >
                                <FontAwesomeIcon icon={faXmark} size={'1x'} />
                            </TextBlock>
                        </div>
                    ))}
                </FiltersSection>
                <EventsChart
                    className="chart"
                    config={state.config}
                    histogramData={state.config.buildHistogramData()}
                    onChangeTimeRange={(timeRange) => state.config && state.config.changeTimeRange(timeRange)}
                    zoom={state.config.zoom}
                    loading={state.config.loading}
                    histogramBreakdownProperty={state.config.currentSearch.histogramBreakdownProperty}
                    // incomplete={!state.config.resultsComplete}
                />
            </MainArea>
            <SectionDiv theme={theme}>
                <TextBlock
                    config={config}
                    className="button"
                    theme={theme}
                    popup={() => ({
                        title: 'Change Zoom',
                        value: zoomToText(config.zoom),
                        commands: [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((value) => ({
                            title: zoomToText(value),
                            onClick({ close }) {
                                close();
                                config.setZoom(value);
                            },
                        })),
                    })}
                >
                    Zoom: {zoomToText(config.zoom)}
                </TextBlock>
                <TextBlock
                    config={config}
                    className="button"
                    theme={theme}
                    popup={() => ({
                        title: 'Change Timezone',
                        value: tzInfo.description,
                        commands: config.timezones.map((tz) => ({
                            title: tz.description,
                            icon: tz.id,
                            onClick({ close }) {
                                close();
                                config.setTimezoneId(tz.id);
                            },
                        })),
                    })}
                >
                    {tzInfo.id}
                </TextBlock>
                <TextBlock
                    config={config}
                    className="button"
                    theme={theme}
                    onClick={() => {
                        config.toggleMultiline();
                    }}
                >
                    {config.multiline ? 'Multiline' : 'Single line'}
                </TextBlock>
                <TextBlock
                    config={config}
                    className="button"
                    theme={theme}
                    onClick={() => {
                        config.toggleNullVisible();
                    }}
                >
                    {config.nullVisible ? 'Null Visible' : 'Null Hidden'}
                </TextBlock>
                <div className="right">
                    <TextBlock config={config} className="button" theme={theme}>
                        {config.loading ? (
                            'Loading…'
                        ) : (
                            <>
                                {config.entriesSelection.entries.length} lines:{' '}
                                {!config.dataBundleStats
                                    ? null
                                    : config.dataBundleStats.recordsMatched === config.dataBundleStats.numResults
                                    ? 'Complete'
                                    : `${Math.round(
                                          (config.dataBundleStats.numResults / config.dataBundleStats.recordsMatched) * 100
                                      )}% of ${millify(config.dataBundleStats.recordsMatched)}`}
                            </>
                        )}
                    </TextBlock>
                </div>
            </SectionDiv>
            <LogEntriesTable config={state.config} style={{ flexGrow: 1 }} />
        </AppDiv>
    );
});

const SavedSearchSection = styled.div`
    display: flex;
    flex-direction: row;
    margin: 0;

    .savedSearchesButton {
        margin-top: 2px;
        min-height: 26px;
        min-width: 26px;
        justify-content: center;
    }

    .title {
        margin-left: 10px;
    }
`;

const MainArea = styled.div`
    padding: 20px 20px 10px 20px;
    display: flex;
    flex-direction: column;

    .chart {
        flex-grow: 1;
    }
`;

const AppDiv = styled.div<SectionParams>`
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    background-color: ${(props) => props.theme.background};
    min-height: 100%;
    height: 100%;
    max-height: 100%;

    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: ${SERIF_FONT};

    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    overflow: hidden;
`;

const FiltersSection = styled.div<{ readonly theme: RegionColorTheme; readonly config: LogTableConfiguration }>`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin: 0 0 10px 0;

    > .filter {
        font-family: ${MONOSPACE_FONT};
        font-size: 12px;
        display: flex;
        flex-direction: row;
        align-items: center;
        background-color: ${(props) => props.theme.lightBackground};
        border: 1px solid ${(props) => props.theme.lines};
        padding: 2px 2px 2px 5px;
        margin: 2px 3px;
        border-radius: 5px;
        > .filter-text {
            max-width: 300px;
            overflow: scroll;
            white-space: nowrap;
        }
        > .button {
            padding: 1px 3px;
            margin: 0 0 0 5px;
        }
    }
    > .filter:first-child {
        margin-left: 0;
    }
    > .dataSourceFilter {
        background-color: ${(props) => props.config.colorTheme.popup.datasource};
    }
`;

interface SectionParams {
    readonly theme: RegionColorTheme;
}

const PageHeader = styled.div<SectionParams>`
    background-color: ${(props) => props.theme.lightBackground};
    border: 1px solid ${(props) => props.theme.lines};
    display: flex;
    justify-content: start;
    width: max-content;
    align-self: start;
    margin-bottom: 5px;
`;

const SectionDiv = styled.div<SectionParams>`
    display: flex;

    .button {
        display: inline;
        padding: 3px 10px;
        border: 1px solid ${(props) => props.theme.lines};
    }

    .right {
        display: flex;
        flex-grow: 1;
        justify-content: end;
    }
`;

const zoomToText = (value: number) => `${Math.round(value * 100)}%`;

export default App;
