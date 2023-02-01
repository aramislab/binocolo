import React from 'react';
import {
    autoUpdate,
    flip,
    FloatingOverlay,
    limitShift,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import { LogTableConfiguration } from '../logic/models.js';
import { EmptyValue, notEmpty, REFERENCE_TEXT_SIZE, SERIF_FONT } from '../logic/types.js';
import { JSONType } from '@binocolo/common/common.js';
import styled from 'styled-components';
import { getJSONBasicTypeOf, getJSONObjectType, isJSONBasicType } from '../logic/inspect_payload.js';

export type PopupMenuCommand = {
    title: string;
    icon?: React.ReactNode;
    onClick: (params: { close: () => void }) => void;
    disabled?: boolean;
};

export type PopupMenuFactory = (params: { close: () => void }) => PopupMenuConfig;

export type PopupMenuConfig = {
    title: React.ReactNode;
    value?: JSONType;
    commands?: (PopupMenuCommand | EmptyValue)[];
    component?: React.ReactNode;
};

type BuildPopupMenuParams = {
    popup?: PopupMenuFactory;
    config: LogTableConfiguration;
};

type BuildPopupMenuResult = {
    popupMenu: React.ReactNode;
    onClick: () => void;
    referenceProps: any;
    reference: any;
};

export function usePopupMenu({ popup, config }: BuildPopupMenuParams): BuildPopupMenuResult {
    const [popupOpen, setPopupOpen] = React.useState<boolean>(false);
    const { x, y, reference, floating, strategy, context } = useFloating({
        open: popupOpen,
        onOpenChange: (open: boolean) => {
            if (!open) {
                setPopupOpen(false);
            }
        },
        placement: 'bottom-start',
        middleware: [flip(), shift({ limiter: limitShift({ offset: 5 }) })],
        whileElementsMounted: autoUpdate,
    });
    const click = useClick(context);
    const dismiss = useDismiss(context, {
        outsidePressEvent: 'mousedown',
    });
    const role = useRole(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);
    const referenceProps = getReferenceProps();

    const onClick = () => {
        setPopupOpen(true);
    };
    let popupMenu: React.ReactNode = null;
    if (popupOpen && popup) {
        popupMenu = (
            <FloatingOverlay lockScroll style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {/* backdropFilter: 'blur(1.1px)' */}
                {/*<FloatingFocusManager context={context} initialFocus={}>*/}
                <MenuContainerDiv
                    ref={floating}
                    {...getFloatingProps()}
                    style={{
                        position: strategy,
                        top: y ?? 0,
                        left: x ?? 0,
                        fontSize: REFERENCE_TEXT_SIZE * config.zoom,
                        textAlign: 'left',
                    }}
                    className="MenuContainer"
                >
                    <MenuContent
                        popupData={popup({
                            close: () => {
                                setPopupOpen(false);
                            },
                        })}
                        config={config}
                        close={() => {
                            setPopupOpen(false);
                        }}
                    />
                </MenuContainerDiv>
                {/*</FloatingFocusManager>*/}
            </FloatingOverlay>
        );
    }
    return { popupMenu, onClick, referenceProps, reference };
}

const MenuContainerDiv = styled.div`
    width: max-content;
    max-width: 1200px;
    background-color: #dad6c4;
    border-radius: 3px;
    border: 1px solid #494747;
    filter: drop-shadow(3px 3px 3px #151515);
    color: #0e0e0e;
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
`;

const MenuContent = ({
    popupData: { title, value, component, commands },
    config,
    close,
}: {
    popupData: PopupMenuConfig;
    config: LogTableConfiguration;
    close: () => void;
}) => (
    <>
        <MenuHeaderDiv className="MenuHeader">{title}</MenuHeaderDiv>
        {value !== undefined && (
            <>
                <MenuFieldTypeDiv>{`${getJSONObjectType(value)}${
                    isJSONBasicType(value) ? `: ${getJSONBasicTypeOf(value)}` : ''
                }`}</MenuFieldTypeDiv>
                <MenuFieldValueDiv>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</MenuFieldValueDiv>
            </>
        )}
        {value !== undefined && commands && commands.length > 0 && <div className="MenuDivider" />}
        {commands && <MenuCommands commands={commands} config={config} close={close} />}
        {component}
    </>
);

const MenuHeaderDiv = styled.div`
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

const MenuFieldTypeDiv = styled.div`
    padding: 6px 6px 0 6px;
    margin: 0;
    white-space: pre;
    overflow: scroll;
`;

const MenuFieldValueDiv = styled.div`
    padding: 6px;
    margin: 0;
    white-space: pre;
    max-height: 200px;
    overflow: scroll;
`;

export const MenuCommands = ({
    commands,
    config,
    close,
}: {
    commands: (PopupMenuCommand | EmptyValue)[];
    config: LogTableConfiguration;
    close?: () => void;
}) => (
    <div>
        {commands.filter(notEmpty).map(({ title, icon, onClick, disabled }) => (
            <MenuCommandRowDiv
                className="MenuCommandRow"
                key={title}
                onClick={() => {
                    if (!disabled) {
                        onClick({
                            close: () => {
                                close && close();
                            },
                        });
                    }
                }}
                disabled={disabled}
            >
                <span className="MenuCommandIcon" style={{ width: REFERENCE_TEXT_SIZE * config.zoom }}>
                    {icon}
                </span>
                <span className="MenuCommandTitle" style={{ fontSize: REFERENCE_TEXT_SIZE * 1.2 * config.zoom }}>
                    {title}
                </span>
            </MenuCommandRowDiv>
        ))}
    </div>
);

const MenuCommandRowDiv = styled.div<{ readonly disabled?: boolean }>`
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
