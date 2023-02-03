import React from 'react';
import styled from 'styled-components';
import { LogTableConfiguration } from '../logic/models.js';
import { REFERENCE_TEXT_SIZE, SERIF_FONT } from '../logic/types.js';

export const MenuContainerDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    width: max-content;
    min-width: 350px;
    max-width: 1200px;
    background-color: #dad6c4;
    border-radius: 3px;
    border: 1px solid #494747;
    filter: drop-shadow(3px 3px 3px #151515);
    color: #0e0e0e;
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
    font-size: ${(props) => REFERENCE_TEXT_SIZE * props.config.zoom}px;
    text-align: left;
`;

export const MenuHeaderDiv = styled.div`
    padding: 6px;
    border-top-left-radius: 3px;
    border-top-right-radius: 3px;
    background-color: #9a9389;
    margin: 0;
    font-weight: bold;

    .MenuDivider {
        padding: 0 0 0 0;
        margin: 0 0 3px 0;
        border-bottom: 1px solid black;
    }
`;

export const MenuFieldTypeDiv = styled.div`
    padding: 6px 6px 0 6px;
    margin: 0;
    white-space: pre;
    overflow: scroll;
`;

export const MenuFieldValueDiv = styled.div`
    padding: 6px;
    margin: 0;
    white-space: pre;
    max-height: 200px;
    overflow: scroll;
`;

export const MenuCommandRowDiv = styled.div<{ readonly disabled?: boolean }>`
    padding: 3px;
    cursor: pointer;
    &:hover {
        background-color: #b9b7a5;
    }
    > .MenuCommandIcon {
        display: inline-block;
        padding: 0 9px 0 3px;
    }
    > .MenuCommandTitle {
        padding: 3px 6px 3px 0;
        text-align: left;
        font-family: ${SERIF_FONT};
    }
`;
