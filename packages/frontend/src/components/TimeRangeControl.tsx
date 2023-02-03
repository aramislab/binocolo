import React from 'react';
import { LogTableConfiguration } from '../logic/models.js';
import { observer } from 'mobx-react-lite';
import { TextBlock } from './TextBlock.js';
import { durationToText } from '@binocolo/common/time.js';
import styled from 'styled-components';
import { RegionColorTheme } from '../logic/themes.js';
import { usePopupMenu } from './PopupMenu.js';
import { DataSourceConfiguration } from './DataSourceConfiguration.js';
import { MONOSPACE_FONT, REFERENCE_TEXT_SIZE } from '../logic/types.js';

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
            component: () => <DataSourceConfiguration config={config} close={close} />,
        }),
        config,
    });

    const tzInfo = config.getTimezoneInfo();

    return (
        <>
            <TimeRangeContainerDiv theme={theme}>
                <TextBlock
                    config={config}
                    className="tz-picker"
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
                </div>
                <TextBlock config={config} className="bucket-size" theme={theme}>
                    {bucketSize}
                </TextBlock>
            </TimeRangeContainerDiv>
            {popupComponent}
        </>
    );
});

interface TimeRangeContainerParams {
    readonly theme: RegionColorTheme;
}

const TimeRangeContainerDiv = styled.div<TimeRangeContainerParams>`
    display: flex;
    justify-content: center;
    align-items: center;
    width: max-content;
    background-color: ${(props) => props.theme.lightBackground};
    border-radius: 3px;

    > .tz-picker {
        padding: 3px 10px;
        text-align: left;
        border-right: 1px solid ${(props) => props.theme.lines};
    }

    > .time-range {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding-left: 5px;
        padding-right: 10px;
        cursor: pointer;

        :hover {
            background-color: ${(props) => props.theme.highlight};
        }
    }

    .bucket-size {
        padding: 0 10px 0 10px;
        min-height: 24px;
        border-left: 1px solid ${(props) => props.theme.lines};
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
