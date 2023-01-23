import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faEye } from '@fortawesome/free-solid-svg-icons';
import { makeStringFromJSONFieldSelector, JSONFieldSelector } from '@binocolo/common/common.js';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import { TextBlock } from './TextBlock.js';
import styled from 'styled-components';

export const PropertyHeaderTitle = observer(
    ({ config, selector, className }: { config: LogTableConfiguration; selector: JSONFieldSelector; className?: string }) => {
        return (
            <TitleDiv className={className}>
                <span style={{ maxWidth: 500, display: 'inline-block', overflow: 'scroll' }}>
                    {makeStringFromJSONFieldSelector(selector)}
                </span>
                <TextBlock
                    config={config}
                    theme={config.colorTheme.light}
                    button
                    className="button"
                    onClick={() => {
                        config.togglePropertyVisibility(selector);
                    }}
                >
                    {config.isPropertyShown(selector) ? 'Hide' : 'Show'}{' '}
                    <FontAwesomeIcon icon={config.isPropertyShown(selector) ? faXmark : faEye} size={'1x'} />
                </TextBlock>
            </TitleDiv>
        );
    }
);

const TitleDiv = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    > .button {
        font-weight: normal;
        padding: 1px 5px;
    }
`;
