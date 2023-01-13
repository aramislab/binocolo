import React from 'react';
import { LogTableConfiguration } from '../logic/models.js';
import { observer } from 'mobx-react-lite';
import { TextBlock } from './TextBlock.js';
import { durationToText } from '@binocolo/common/time.js';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { RegionColorTheme } from '../logic/themes.js';
import { usePopupMenu } from './PopupMenu.js';
import { DataSourceConfiguration } from './DataSourceConfiguration.js';
import { MONOSPACE_FONT, REFERENCE_TEXT_SIZE } from '../logic/types.js';
import { millify } from 'millify';
import { FieldsPicker } from './FieldsPicker.js';
import { DataSourcePicker } from './DataSourcePicker.js';

export const TimeRangeControl = observer(({ config }: { config: LogTableConfiguration }) => {
    const { startText, endText, bucketSize } = config.getTimeRangeData();

    const theme = config.colorTheme.light;

    const {
        popupMenu: popupComponent,
        onClick: _onClick,
        referenceProps: _referenceProps,
        reference: _popupReference,
    } = usePopupMenu({
        popup: ({ close }) => ({
            title: 'Data Source Parameters',
            component: <DataSourceConfiguration config={config} close={close} />,
        }),
        config,
    });

    return (
        <>
            <TimeRangeContainer theme={theme}>
                <TextBlock
                    config={config}
                    style={{
                        padding: '3px 10px',
                        // width: 200,
                        textAlign: 'left',
                    }}
                    theme={theme}
                    popup={({ close }) => ({
                        title: 'Data Sources',
                        component: <DataSourcePicker config={config} close={close} />,
                    })}
                >
                    {config.getDataSourceName()}
                </TextBlock>
                <TextBlock
                    config={config}
                    style={{
                        padding: '3px 10px',
                        // width: 200,
                        textAlign: 'left',
                    }}
                    theme={theme}
                    popup={({ close }) => ({
                        title: 'Fields',
                        component: <FieldsPicker config={config} close={close} />,
                    })}
                >
                    Fields
                </TextBlock>
                <div className="time-range" ref={_popupReference} {..._referenceProps} onClick={_onClick}>
                    <TextBlock config={config} style={{ display: 'inline', padding: 3 }} theme={theme} selectable>
                        {startText}
                    </TextBlock>
                    <TextBlock
                        config={config}
                        style={{ display: 'inline', padding: '3px 10px', width: 90, textAlign: 'center' }}
                        theme={theme}
                    >
                        <b>{durationToText(config.elaboratedTimeRange.timeRange)}</b>
                    </TextBlock>
                    <TextBlock config={config} style={{ display: 'inline-block', padding: 3 }} theme={theme} selectable>
                        {endText}
                    </TextBlock>
                    <BucketContainerDiv>
                        <TextBlock
                            config={config}
                            style={{
                                display: 'inline-block',
                                padding: '1px 3px',
                                borderRadius: 3,
                                marginLeft: 5,
                                border: `1px dashed ${theme.text}`,
                            }}
                            theme={theme}
                        >
                            {bucketSize}
                        </TextBlock>
                    </BucketContainerDiv>
                </div>
                <TextBlock
                    config={config}
                    style={{ padding: 3 }}
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
                <div className="result-stats">
                    {!config.dataBundleStats
                        ? null
                        : config.dataBundleStats.recordsMatched === config.dataBundleStats.numResults
                        ? 'Results complete'
                        : `Results: ${Math.round(
                              (config.dataBundleStats.numResults / config.dataBundleStats.recordsMatched) * 100
                          )}% of ${millify(config.dataBundleStats.recordsMatched)}`}
                </div>
                <TextBlock
                    config={config}
                    style={{ padding: '3px 10px', width: 80 }}
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
            </TimeRangeContainer>
            {popupComponent}
        </>
    );
});

interface TimeRangeContainerParams {
    readonly theme: RegionColorTheme;
}

const TimeRangeContainer = styled.div<TimeRangeContainerParams>`
    display: flex;
    justify-content: center;
    width: max-content;
    padding: 5px;
    //border-bottom: 1px solid ${(props) => props.theme.text};
    background-color: ${(props) => props.theme.lightBackground};

    > .time-range {
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    > .result-stats {
        display: flex;
        flex-direction: row;
        font-family: ${MONOSPACE_FONT};
        font-size: ${REFERENCE_TEXT_SIZE}px;
        margin: 0 20px;
        align-items: center;
    }
`;

const BucketContainerDiv = styled.div`
    width: 90px;
`;

// popup={() => ({
//     title: 'Choose Time Range',
//     commands: config.timeRanges.map(({ durationInSec, description }) => ({
//         title: description,
//         onClick({ close }) {
//             config.changeTimeRangeByDuration(durationInSec);
//             close();
//         },
//     })),
// })}
