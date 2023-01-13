import { Command } from 'commander';

type CLICommand = RunServerCommand | AddDataSourceCommand;

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

export function parseCommandLineArguments(): CLICommand {
    const program = new Command();
    let result: CLICommand;
    program
        .name('binocolo')
        .description('Binocolo CLI')
        .option('-v, --verbose', 'Show verbose log')
        .version('0.0.1', '--version', 'Output the version number');

    program
        .command('runServer', { isDefault: true })
        .description('Run server')
        .option('-p, --port <port>', 'Port to listen to (default picks the first available open port)')
        .option('-o, --host <host>', 'Address to bind (defaults to localhost)')
        .option('-n, --nobrowser', 'Do not open browser')
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

    program.parse();

    // @ts-ignore
    return result;
}
