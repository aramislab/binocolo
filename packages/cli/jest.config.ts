/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    transform: {
        '^.+\\.ts?$': [
            'esbuild-jest',
            {
                target: 'es2020',
            },
        ],
    },
    clearMocks: true,
    verbose: true,
    silent: false,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    testMatch: ['**/tests/*.test.ts'],
};
