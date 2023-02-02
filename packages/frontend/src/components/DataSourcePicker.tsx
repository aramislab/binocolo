import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';

export const DataSourcePicker = ({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    return (
        <DataSourcePickerContainerDiv config={config}>
            {config.dataSourceSets.map(
                (dataSourceSet) =>
                    dataSourceSet.dataSources.length > 0 && (
                        <div key={dataSourceSet.id} className="section">
                            <div className="title">{dataSourceSet.name}</div>
                            {dataSourceSet.dataSources.map((dataSource) => (
                                <TextBlock
                                    key={dataSource.id}
                                    config={config}
                                    className="button"
                                    theme={config.colorTheme.light}
                                    onClick={() => {
                                        close();
                                        config.changeDataSource(dataSource.id);
                                    }}
                                >
                                    {dataSource.name}
                                </TextBlock>
                            ))}
                        </div>
                    )
            )}
        </DataSourcePickerContainerDiv>
    );
};

const DataSourcePickerContainerDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    color: ${(props) => props.config.colorTheme.light.text};
    padding: 5px;
    display: flex;
    flex-direction: column;

    .section {
        margin-top: 10px;
    }

    .section:first-child {
        margin-top: 0;
    }

    .title {
        font-weight: bold;
        font-style: italic;
        text-decoration: underline;
        margin-bottom: 5px;
    }

    .button {
        padding: 2px 0;
    }
`;
