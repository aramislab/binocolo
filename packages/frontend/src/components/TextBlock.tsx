import { observer } from 'mobx-react-lite';
import React from 'react';
import { LogTableConfiguration } from '../logic/models.js';
import { PopupMenuConfig, usePopupMenu } from './PopupMenu.js';
import { LINE_HEIGHT, REFERENCE_TEXT_SIZE } from '../logic/types.js';
import styled from 'styled-components';
import { RegionColorTheme } from '../logic/themes.js';

export const TextBlock = observer(
    React.forwardRef(
        (
            {
                className,
                numLines = 1,
                style,
                children,
                config,
                onClick,
                popup,
                theme,
                button,
                disabled,
                tooltip,
                selectable,
            }: {
                children: React.ReactNode;
                numLines?: number;
                config: LogTableConfiguration;
                theme: RegionColorTheme;
                tooltip?: string;
                button?: boolean;
                disabled?: boolean;
                className?: string;
                style?: React.CSSProperties;
                onClick?: () => void;
                popup?: (params: { close: () => void }) => PopupMenuConfig;
                selectable?: boolean;
            },
            ref
        ) => {
            const height = REFERENCE_TEXT_SIZE * LINE_HEIGHT * config.zoom * numLines;
            const {
                popupMenu: popupComponent,
                onClick: _onClick,
                referenceProps: _referenceProps,
                reference: _popupReference,
            } = usePopupMenu({ popup, config });
            if (popup) {
                onClick = _onClick;
            }
            return (
                <>
                    <TextBlockDiv
                        height={height}
                        config={config}
                        theme={theme}
                        clickable={!!popup || !!onClick || button}
                        button={button}
                        disabled={disabled}
                        selectable={selectable}
                        ref={(node) => {
                            if (_popupReference) {
                                _popupReference(node);
                            }
                            if (ref) {
                                if (typeof ref === 'function') {
                                    ref(node);
                                } else {
                                    ref.current = node;
                                }
                            }
                        }}
                        {..._referenceProps}
                        className={className}
                        style={style}
                        onClick={(evt) => {
                            // evt.stopPropagation();
                            onClick && onClick();
                        }}
                    >
                        {children}
                        {tooltip && <TooltipDiv className="tooltip">{tooltip}</TooltipDiv>}
                    </TextBlockDiv>
                    {popupComponent}
                </>
            );
        }
    )
);

const TooltipDiv = styled.div`
    visibility: hidden;
    width: max-content;
    background-color: black;
    color: #fff;
    text-align: center;
    padding: 5px 8px;
    border-radius: 5px;
    position: absolute;
`;

interface TextBlockProps {
    readonly height: number;
    readonly config: LogTableConfiguration;
    readonly theme: RegionColorTheme;
    readonly clickable: boolean;
    readonly button?: boolean;
    readonly disabled?: boolean;
    readonly selectable?: boolean;
}

const TextBlockDiv = styled.div<TextBlockProps>`
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
    white-space: pre;
    display: flex;
    align-items: center;
    line-height: ${LINE_HEIGHT};
    user-select: ${(props) => (props.selectable ? null : 'none')};
    cursor: ${(props) => (props.clickable && !props.disabled ? 'pointer' : null)};
    color: ${(props) => (props.disabled ? props.theme.disabled : null)};
    font-size: ${(props) => REFERENCE_TEXT_SIZE * props.config.zoom}px;
    height: ${(props) => props.height}px;
    min-height: ${(props) => props.height}px;
    max-height: ${(props) => props.height}px;
    border: ${(props) => (props.button ? `1px solid ${props.theme.lines}` : null)};
    border-radius: ${(props) => (props.button ? '3px' : null)};
    background-color: ${(props) => (props.button && !props.disabled ? props.theme.button : null)};

    &:hover {
        background-color: ${(props) => (props.clickable && !props.disabled ? props.theme.highlight : null)};

        > .tooltip {
            visibility: visible;
        }
    }
`;
