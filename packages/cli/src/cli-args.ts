import { Command } from 'commander';

type CLICommand = RunServerCommand | AddDataSourceCommand | AddDataSourceSetCommand | EditDataSourceCommand;

type RunServerCommand = {
    type: 'runServer';
    verbose: boolean;
    port?: number;
    host?: string;
    nobrowser: boolean;
};

type AddDataSourceCommand = {
    type: 'addDataSource';
};

type AddDataSourceSetCommand = {
    type: 'addDataSourceSet';
};

type EditDataSourceCommand = {
    type: 'editDataSource';
};

export function parseCommandLineArguments(): CLICommand {
    const program = new Command();
    let result: CLICommand;
    program.name('binocolo').description('Binocolo CLI').version('0.0.1', '--version', 'Output the version number');

    program
        .command('runServer', { isDefault: true })
        .description('Run server')
        .option('-p, --port <port>', 'Port to listen to (default picks the first available open port)')
        .option('-o, --host <host>', 'Address to bind (defaults to localhost)')
        .option('-n, --nobrowser', 'Do not open browser')
        .option('-v, --verbose', 'Show verbose log')
        .action(function () {
            // @ts-ignore
            const opts = this.opts();
            result = {
                type: 'runServer',
                verbose: !!opts.verbose,
                port: opts.port ? parseInt(opts.port) : undefined,
                host: opts.host,
                nobrowser: !!opts.nobrowser,
            };
        });

    program
        .command('addDataSource')
        .description('Add new Data Source')
        .action(() => {
            result = {
                type: 'addDataSource',
            };
        });

    program
        .command('editDataSource')
        .description('Edit Data Source')
        .action(() => {
            result = {
                type: 'editDataSource',
            };
        });

    program
        .command('addDataSourceSet')
        .description('Add new Data Source Set')
        .action(() => {
            result = {
                type: 'addDataSourceSet',
            };
        });

    program.parse();

    // @ts-ignore
    return result;
}
