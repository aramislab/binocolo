import React from 'react';
import { observer } from 'mobx-react-lite';
import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';
import { SERIF_FONT } from '../logic/types.js';

export const SavedSearches = observer(({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    const [searchName, setSearchName] = React.useState<string>('');
    const currentSearchTitle = config.getSavedSearchTitle();
    return (
        <SavedSearchesContainerDiv config={config}>
            {/* <SeparatorDiv config={config} /> */}
            <CommandsBlockDiv>
                {/* <div className="title">Saved Searches:</div> */}
                {config.savedSearches.map(({ title, id }) => (
                    <TextBlock
                        key={id}
                        config={config}
                        className={`button ${id === config.selectedSavedSearchId ? 'selected-search' : ''}`}
                        theme={config.colorTheme.light}
                        onClick={() => {
                            close();
                            config.selectSavedSearchById(id);
                        }}
                    >
                        {title}
                    </TextBlock>
                ))}
            </CommandsBlockDiv>
        </SavedSearchesContainerDiv>
    );
});

const SeparatorDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    border-bottom: 1px solid ${(props) => props.config.colorTheme.light.lines};
`;

const CommandsBlockDiv = styled.div`
    padding: 5px 0;
`;

const SavedSearchesContainerDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    color: ${(props) => props.config.colorTheme.light.text};
    display: flex;
    flex-direction: column;

    .title {
        margin: 0 0 5px 0;
        padding: 0;
        font-family: ${SERIF_FONT};
        font-size: 12px;
        font-weight: bold;
    }

    .button {
        padding: 2px 5px;
    }

    .selected-search {
        font-weight: bold;
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
