import React from 'react';
import { JSONBasicType, JSONBasicTypeName } from '@binocolo/common/common.js';
import { PopupMenuFactory } from './PopupMenu.js';
import { LogTableConfiguration } from '../logic/models.js';
import { RegionColorTheme } from '../logic/themes.js';
import { TextBlock } from './TextBlock.js';

export const JSONBasicValueTextBlock = ({
    className,
    style,
    value,
    dataType,
    popup,
    config,
    theme,
}: {
    dataType: JSONBasicTypeName;
    className?: string;
    style?: React.CSSProperties;
    value: JSONBasicType;
    popup?: PopupMenuFactory;
    config: LogTableConfiguration;
    theme: RegionColorTheme;
}) => (
    <TextBlock
        className={className}
        style={{ ...style, color: config.colorTheme.types[dataType] }}
        config={config}
        theme={theme}
        popup={popup}
        numLines={1}
    >
        {value === null ? <i>null</i> : JSON.stringify(value)}
    </TextBlock>
);
