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
import { DataSourcePicker } from './DataSourcePicker.js';
import { FieldsPicker } from './FieldsPicker.js';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

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

    return (
        <AppDiv theme={theme}>
            <MainAreaDiv>
                <SectionDiv>
                    <TitleSectionDiv theme={config.colorTheme.light}>
                        <TextBlock
                            config={config}
                            className="data-source"
                            theme={theme}
                            popup={({ close }) => ({
                                title: 'Data Sources',
                                component: <DataSourcePicker config={config} close={close} />,
                            })}
                        >
                            {config.getDataSourceName()}
                        </TextBlock>
                        <div className="field-button-container">
                            <TextBlock
                                config={config}
                                className="field-button"
                                theme={theme}
                                // button
                                popup={({ close }) => ({
                                    title: 'Fields',
                                    component: <FieldsPicker config={config} close={close} />,
                                })}
                            >
                                Fields
                            </TextBlock>
                        </div>
                    </TitleSectionDiv>
                    <div className="right">
                        <TimeRangeControl config={state.config} />
                        <TextBlock
                            config={config}
                            style={{ padding: 3, marginLeft: 10 }}
                            theme={theme}
                            onClick={() => {
                                if (config.timeRangeEdited()) {
                                    config.restoreTimeRange();
                                }
                            }}
                            button
                            disabled={!config.timeRangeEdited()}
                        >
                            Zoom Out <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </TextBlock>
                        <TextBlock
                            config={config}
                            style={{ padding: '3px 10px', width: 80, marginLeft: 10, justifyContent: 'center' }}
                            theme={theme}
                            button
                            onClick={() => {
                                if (config.loading) {
                                    config.stopQuery();
                                } else {
                                    config.loadEntriesFromDataSource();
                                }
                            }}
                        >
                            {config.loading ? 'Stop Query' : 'Reload'}
                        </TextBlock>
                    </div>
                </SectionDiv>
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
            </MainAreaDiv>
            <SectionDiv theme={theme}>
                {/* <TextBlock
                    config={config}
                    className="section-button"
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
                </TextBlock> */}

                <TextBlock config={config} className="section-button" theme={theme}>
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
                <div className="right">
                    <TextBlock
                        config={config}
                        className="section-button"
                        theme={theme}
                        onClick={() => {
                            config.toggleMultiline();
                        }}
                    >
                        {config.multiline ? 'Multiline' : 'Single line'}
                    </TextBlock>
                    <TextBlock
                        config={config}
                        className="section-button"
                        theme={theme}
                        onClick={() => {
                            config.toggleNullVisible();
                        }}
                    >
                        {config.nullVisible ? 'Null Visible' : 'Null Hidden'}
                    </TextBlock>
                </div>
            </SectionDiv>
            <LogEntriesTable config={state.config} style={{ flexGrow: 1 }} />
        </AppDiv>
    );
});

const TitleSectionDiv = styled.div<SectionParams>`
    display: flex;
    .data-source {
        font-family: ${SERIF_FONT};
        font-weight: bold;
        font-size: 18px;
        padding: 2px 0px;
        margin-right: 40px;
    }
    .field-button-container {
        height: 24px;
        background-color: ${(props) => props.theme.lightBackground};
        border-radius: 3px;
        display: flex;
        align-items: center;
        .field-button {
            padding: 4px 10px;
        }
    }
`;

const SavedSearchSection = styled.div`
    display: flex;
    flex-direction: row;
    margin: 10px 0 0 0;

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

const MainAreaDiv = styled.div`
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

const SectionDiv = styled.div<SectionParams>`
    display: flex;

    .section-button {
        display: inline;
        padding: 3px 10px;
        border: 1px solid ${(props) => props.theme.lines};
    }

    .right {
        display: flex;
        flex-grow: 1;
        justify-content: end;
        align-items: center;
    }
`;

const zoomToText = (value: number) => `${Math.round(value * 100)}%`;

export default App;
