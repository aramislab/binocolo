import { LogTableConfiguration } from '../logic/models.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';

export const DataSourcePicker = ({ config, close }: { config: LogTableConfiguration; close: () => void }) => {
    return (
        <DataSourcePickerContainerDiv config={config}>
            {config.dataSources.map((dataSource) => (
                <div key={dataSource.id}>
                    <TextBlock
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
                </div>
            ))}
        </DataSourcePickerContainerDiv>
    );
};

const DataSourcePickerContainerDiv = styled.div<{ readonly config: LogTableConfiguration }>`
    color: ${(props) => props.config.colorTheme.light.text};
    padding: 5px;
    display: flex;
    flex-direction: column;

    .button {
        padding: 3px 5px;
    }
`;
