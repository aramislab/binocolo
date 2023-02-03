import styled from 'styled-components';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import { MenuContainerDiv, MenuHeaderDiv } from './DialogComponents.js';
import { JSONBasicValueTextBlock } from './JSONBasicValueTextBlock.js';
import { getJSONBasicTypeName, MatchDataSourceFilter } from '@binocolo/common/common.js';
import { faAdd, faMinus } from '@fortawesome/free-solid-svg-icons';
import { IconButton } from './IconButton.js';

export const MatchSearchAccumulatorBox = observer(({ config, className }: { config: LogTableConfiguration; className?: string }) => {
    if (!config.matchSearchAccumulator) {
        return null;
    }
    const { selector, exact, values } = config.matchSearchAccumulator;
    const onClick = (include: boolean) => () => {
        config.addAccumulatedFilter(include);
    };
    return (
        <MenuContainerDiv config={config} className={`MenuContainer ${className || ''}`}>
            <MenuHeaderDiv className="MenuHeader">{selector}</MenuHeaderDiv>
            <ContentDiv config={config}>
                {values.map((value, idx) => (
                    <JSONBasicValueTextBlock
                        key={idx}
                        className="value"
                        config={config}
                        theme={config.colorTheme.light}
                        value={value}
                        dataType={getJSONBasicTypeName(value)}
                    />
                ))}
                <div className="actions">{exact ? 'Exact match' : 'Substring match'}</div>
                <div className="line">
                    <IconButton
                        config={config}
                        icon={faAdd}
                        onClick={() => {
                            config.addAccumulatedFilter(true);
                        }}
                    />
                    <span>Match ANY value</span>
                </div>
                <div className="line">
                    <IconButton
                        config={config}
                        icon={faMinus}
                        onClick={() => {
                            config.addAccumulatedFilter(false);
                        }}
                    />
                    <span>Match NO value</span>
                </div>
            </ContentDiv>
        </MenuContainerDiv>
    );
});

const ContentDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    padding: 10px 5px;

    .value {
        background-color: ${(props) => props.config.colorTheme.dark.background};
        padding: 2px 5px;
        margin: 2px 0;
        border-radius: 3px;
        width: max-content;
    }

    .actions {
        margin: 15px 0 8px 0;
        font-weight: bold;
    }

    .line {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin: 2px 0;

        span {
            margin-left: 5px;
        }
    }
`;
