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
import { getJSONBasicTypeOf, getJSONObjectType, isJSONBasicType } from '../logic/inspect_payload.js';
import { MenuCommandRowDiv, MenuContainerDiv, MenuFieldTypeDiv, MenuFieldValueDiv, MenuHeaderDiv } from './DialogComponents.js';

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
    component?: (params: { getSelectedText: () => string | null }) => React.ReactNode;
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
                    config={config}
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

const MenuContent = ({
    popupData: { title, value, component, commands },
    config,
    close,
}: {
    popupData: PopupMenuConfig;
    config: LogTableConfiguration;
    close: () => void;
}) => {
    const [selectedTextInDocument, setSelectedTextInDocument] = React.useState<string | null>(null);
    const [selectedText, setSelectedText] = React.useState<string | null>(null);
    const onSelectionChange = () => {
        const selection = document.getSelection();
        if (selection) {
            const text = selection.toString();
            if (text.length > 0) {
                setSelectedTextInDocument(text);
            } else {
                // Delay clearing the selected text buffer to allow clicking buttons (which might clear the current selection)
                setTimeout(() => {
                    setSelectedTextInDocument(null);
                    setSelectedText(null);
                }, 50);
            }
        }
    };
    React.useEffect(() => {
        document.addEventListener('selectionchange', onSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', onSelectionChange);
        };
    }, []);
    const onMouseUp = () => {
        if (typeof value === 'string') {
            setSelectedText(selectedTextInDocument);
        }
    };
    return (
        <>
            <MenuHeaderDiv className="MenuHeader">{title}</MenuHeaderDiv>
            {value !== undefined && (
                <>
                    <MenuFieldTypeDiv>{`${getJSONObjectType(value)}${
                        isJSONBasicType(value) ? `: ${getJSONBasicTypeOf(value)}` : ''
                    }`}</MenuFieldTypeDiv>
                    <MenuFieldValueDiv onMouseUp={onMouseUp}>
                        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                    </MenuFieldValueDiv>
                </>
            )}
            {value !== undefined && commands && commands.length > 0 && <div className="MenuDivider" />}
            {commands && <MenuCommands commands={commands} config={config} close={close} />}
            {component && component({ getSelectedText: () => selectedText })}
        </>
    );
};

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
