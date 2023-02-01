import React from 'react';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';
import { SERIF_FONT } from '../logic/types.js';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PopupMenuConfig, usePopupMenu } from './PopupMenu.js';

export const SearchTitle = observer(({ config, className }: { config: LogTableConfiguration; className?: string }) => {
    const [editing, setEditing] = React.useState<boolean>(false);
    const [title, setTitle] = React.useState<string | null>(config.getSavedSearchTitle());
    const [originalTitle, setOriginalTitle] = React.useState<string | null>(config.getSavedSearchTitle());
    React.useEffect(() => {
        const title = config.getSavedSearchTitle();
        setTitle(title);
        setOriginalTitle(title);
        setEditing(false);
        if (inputRef.current) {
            inputRef.current.blur();
        }
    }, [config.getSavedSearchTitle()]);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const popup = ({ close }: { close: () => void }): PopupMenuConfig => {
        return {
            title: 'Delete Search',
            component: (
                <DeleteDialogDiv>
                    <p>
                        Are you sure you want to delete the saved search named "<b>{originalTitle}</b>"?
                    </p>
                    <TextBlock
                        config={config}
                        className="delete-button"
                        theme={config.colorTheme.light}
                        button
                        onClick={() => {
                            close();
                            config.deleteSelectedSearch();
                        }}
                    >
                        Delete Search
                    </TextBlock>
                </DeleteDialogDiv>
            ),
        };
    };
    const { popupMenu: deleteDialog, onClick: openDeleteDialog, referenceProps, reference } = usePopupMenu({ popup, config });
    const canSave: boolean = (title && title.length > 0 && title !== originalTitle) || config.isSearchChanged();
    return (
        <SearchTitleDiv
            className={className}
            ref={reference}
            {...referenceProps}
            config={config}
            editing={editing}
            changed={!editing && config.isSearchChanged()}
            unnamed={title === null}
        >
            <input
                ref={inputRef}
                className="input"
                type="text"
                value={editing ? title || '' : title || 'Unnamed Search'}
                onChange={(evt) => {
                    setTitle(evt.target.value);
                }}
                onSelect={(evt) => {
                    setEditing(true);
                }}
                onBlur={(evt) => {
                    setTimeout(() => {
                        setEditing(false);
                        setTitle(config.getSavedSearchTitle());
                    }, 100);
                }}
            />
            {editing && originalTitle !== null && (
                <TextBlock
                    config={config}
                    className="save-button"
                    theme={config.colorTheme.light}
                    button
                    disabled={!canSave}
                    onClick={() => {
                        if (title) {
                            config.saveSearch({ title });
                        }
                    }}
                >
                    Save
                </TextBlock>
            )}
            {editing && title !== originalTitle && (
                <TextBlock
                    config={config}
                    className="save-button"
                    theme={config.colorTheme.light}
                    button
                    disabled={!title || title.length === 0}
                    onClick={() => {
                        if (title) {
                            config.saveSearch({ title, asNew: true });
                        }
                    }}
                >
                    Save as New
                </TextBlock>
            )}
            {editing && originalTitle !== null && title === originalTitle && !config.isSearchChanged() && (
                <TextBlock
                    config={config}
                    className="save-button trash"
                    theme={config.colorTheme.light}
                    button
                    onClick={() => {
                        openDeleteDialog();
                    }}
                >
                    <FontAwesomeIcon icon={faTrashCan} size={'1x'} />
                </TextBlock>
            )}
            {deleteDialog}
        </SearchTitleDiv>
    );
});

const SearchTitleDiv = styled.div<{
    readonly config: LogTableConfiguration;
    readonly editing: boolean;
    readonly unnamed: boolean;
    readonly changed: boolean;
}>`
    display: flex;
    align-items: center;

    .input {
        display: flex;
        font-family: ${SERIF_FONT};
        align-items: center;
        font-size: 14px;
        margin-top: 2px;
        height: 20px;
        border: none;
        border-radius: 3px;
        background-color: ${(props) => (props.editing ? props.config.colorTheme.light.lightBackground : 'transparent')};
        outline: none;
        padding: 3px 5px;
        width: 200px;
        font-style: ${(props) => (props.unnamed ? 'italic' : null)};
        font-weight: ${(props) => (props.changed ? 'bold' : null)};

        :hover {
            background-color: ${(props) => props.config.colorTheme.light.lightBackground};
        }
    }

    .save-button {
        width: fit-content;
        min-width: fit-content;
        margin: 2px 0 0 5px;
        padding-left: 10px;
        padding-right: 10px;
        min-height: 26px;
        display: flex;
        justify-content: center;
    }

    .trash {
        color: ${(props) => props.config.colorTheme.light.warning};
    }
`;

const DeleteDialogDiv = styled.div`
    padding: 10px;
    max-width: 300px;
    display: flex;
    flex-direction: column;

    .delete-button {
        padding: 3px 10px;
        width: fit-content;
        align-self: end;
    }
`;
