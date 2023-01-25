import { LogTableConfiguration } from '../logic/models.js';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { TextBlock } from './TextBlock.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

export const IconButton = ({ config, onClick, icon }: { config: LogTableConfiguration; onClick: () => void; icon: IconProp }) => (
    <TextBlock
        style={{ maxWidth: 'max-content', padding: '1px 6px', marginRight: 3 }}
        config={config}
        theme={config.colorTheme.light}
        button
        onClick={onClick}
    >
        <FontAwesomeIcon icon={icon} size={'xs'} />
    </TextBlock>
);
