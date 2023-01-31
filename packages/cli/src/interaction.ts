import inquirer from 'inquirer';
import { ServiceSpecs } from '@binocolo/serialization/types.js';
import { serializeDataSourceSpecification, deserializeDataSourceSpecification } from '@binocolo/serialization/data-source/serialize.js';
import {
    DataSourceSetDescriptor,
    DataSourceSpecification,
    DataSourceWithSavedSearches,
    IDataSourceSetStorage,
} from '@binocolo/backend/types';
import { LocalConfiguration } from './local-storage';

export async function editDataSource(config: LocalConfiguration) {
    console.log('Editing data source:');
    const { dataSourceSetStorage, dataSource } = await promptDataSource(config);
    const dataSourceJson = JSON.stringify(serializeDataSourceSpecification(dataSource.spec), null, 2);
    let answers = await inquirer.prompt([
        {
            type: 'editor',
            name: 'dataSource',
            message: 'Data Source',
            default: dataSourceJson,
        },
    ]);
    const editedDataSourceJson: string = answers.dataSource;
    const { dataSource: editedDataSource } = deserializeDataSourceSpecification(JSON.parse(editedDataSourceJson), 'manually edited data');
    await dataSourceSetStorage.updateDataSource(editedDataSource);
}

async function promptDataSource(
    config: LocalConfiguration
): Promise<{ dataSourceSetStorage: IDataSourceSetStorage<ServiceSpecs>; dataSource: DataSourceWithSavedSearches<ServiceSpecs> }> {
    const dssDescriptors = await config.getDataSourceSetDescriptors();
    let answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'dataSourceSetId',
            message: 'Data Source Set',
            choices: dssDescriptors.map((dssDesc) => ({ name: dssDesc.name, value: dssDesc.id })),
            prefix: '',
            suffix: '?',
        },
    ]);
    const dssStorage = await config.getDataSourceSetStorage(answers.dataSourceSetId);
    const dataSources = await dssStorage.getDataSources();
    answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'dataSource',
            message: 'Data Source',
            choices: dataSources.map((ds) => ({ name: ds.spec.name, value: ds })),
            prefix: '',
            suffix: '?',
        },
    ]);
    return {
        dataSourceSetStorage: dssStorage,
        dataSource: answers.dataSource,
    };
}

export async function promptForNewDataSourceSpecification(
    dataSourceSets: DataSourceSetDescriptor<ServiceSpecs>[]
): Promise<{ spec: DataSourceSpecification<ServiceSpecs>; dataSourceSetId: string }> {
    if (dataSourceSets.length < 1) {
        throw new Error('Must provide at least one data source set name');
    }

    console.log('Creating a new data source of type AWS CloudWatch Logs:');
    let answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'dataSourceSetId',
            message: 'Where do you want to store this data source',
            choices: dataSourceSets.map((dss) => ({ name: dss.name, value: dss.id })),
            when: dataSourceSets.length > 1,
            prefix: '',
            suffix: '?',
        },
        {
            type: 'input',
            name: 'dataSourceId',
            message: 'Unique ID',
            transformer: makeId,
            filter: makeId,
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'name',
            message: 'Name to display in the UI',
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'region',
            message: 'AWS Region',
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'logGroupName',
            message: 'Log Group name',
            suffix: ' >',
        },
        {
            type: 'confirm',
            name: 'moreLogGroups',
            message: 'Do you want to add more Log Groups',
            suffix: ' ?',
            prefix: '',
            default: false,
        },
    ]);
    let moreLogGroups: boolean = answers.moreLogGroups;
    let logGroupNames: string[] = [answers.logGroupName];
    while (moreLogGroups) {
        let moreAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'logGroupName',
                message: 'Log Group name (leave empty to stop)',
                suffix: ' >',
            },
        ]);
        if (moreAnswers.logGroupName) {
            logGroupNames.push(moreAnswers.logGroupName);
        } else {
            moreLogGroups = false;
        }
    }
    return {
        dataSourceSetId: dataSourceSets.length === 1 ? dataSourceSets[0].id : answers.dataSourceSetId,
        spec: {
            id: answers.dataSourceId,
            name: answers.name,
            adapter: {
                type: 'AWSCloudWatch',
                region: answers.region,
                logGroupNames,
            },
            knownProperties: [],
        },
    };
}

export async function promptForNewDataSourceSetSpecification(): Promise<DataSourceSetDescriptor<ServiceSpecs>> {
    console.log('Creating a new data source Set on AWS S3:');
    let answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'id',
            message: 'Unique ID',
            transformer: makeId,
            filter: makeId,
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'name',
            message: 'Name to display in the UI',
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'region',
            message: 'AWS Region',
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'bucket',
            message: 'Bucket Name',
            suffix: ' >',
        },
        {
            type: 'input',
            name: 'prefix',
            message: 'Key Prefix',
            suffix: ' >',
        },
    ]);
    return {
        id: answers.id,
        name: answers.name,
        spec: {
            type: 'AWSS3',
            region: answers.region,
            bucket: answers.bucket,
            prefix: answers.prefix,
        },
    };
}

const makeId = (text: string): string => {
    return text.replace(/[^a-zA-Z\d\-]/g, '-');
};
