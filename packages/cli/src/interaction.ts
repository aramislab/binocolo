import inquirer from 'inquirer';
import { DataSourceSpecification } from './data-sources.js';

export async function promptForNewDataSourceSpecification(): Promise<DataSourceSpecification> {
    const makeDataSourceId = (text: string): string => {
        return text.replace(/[^a-zA-Z\d\-]/g, '-');
    };

    console.log('Creating a new data source of type AWS CloudWatch Logs:');
    let answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'dataSourceId',
            message: 'Unique ID',
            transformer: makeDataSourceId,
            filter: makeDataSourceId,
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
        id: answers.dataSourceId,
        name: answers.name,
        adapter: {
            type: 'AWSCloudWatch',
            region: answers.region,
            logGroupNames,
        },
        knownProperties: [],
    };
}
