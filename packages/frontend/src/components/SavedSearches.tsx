import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';
import React from 'react';

export const SavedSearches = observer(({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    const [searchName, setSearchName] = React.useState<string>('');
    return (
        <SavedSearchesContainerDiv config={config}>
            {config.savedSearches.map(({ title, id }) => (
                <TextBlock
                    key={id}
                    config={config}
                    className="button"
                    theme={config.colorTheme.light}
                    onClick={() => {
                        close();
                        config.selectSavedSearch(id);
                    }}
                >
                    {title}
                </TextBlock>
            ))}
            <div className="save">
                <input
                    type="text"
                    placeholder="Save search…"
                    value={searchName}
                    onChange={(evt) => {
                        setSearchName(evt.target.value);
                    }}
                ></input>
                {searchName.length > 0 && (
                    <TextBlock
                        className="saveButton"
                        config={config}
                        theme={config.colorTheme.light}
                        numLines={1}
                        button
                        onClick={() => {
                            config.saveSearch(searchName);
                        }}
                        disabled={!config.isSavedSearchNameValid(searchName)}
                    >
                        Save
                    </TextBlock>
                )}
            </div>
        </SavedSearchesContainerDiv>
    );
});

const SavedSearchesContainerDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    color: ${(props) => props.config.colorTheme.light.text};
    padding: 5px;
    display: flex;
    flex-direction: column;

    .button {
        padding: 2px 0;
    }

    .save {
        display: flex;
        align-items: center;
        width: 250px;
        input {
            outline: none;
            height: 18px;
            flex-grow: 1;
            border-radius: 3px;
            border: 1px solid ${(props) => props.config.colorTheme.dark.lines};
            background-color: ${(props) => props.config.colorTheme.light.background};
        }
        .saveButton {
            margin-left: 5px;
            padding: 1px 5px;
            width: 40px;
            justify-content: center;
        }
    }
`;
