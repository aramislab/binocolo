const fs = require('node:fs/promises');

module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'scope-enum': async () => {
            const packageNames = await fs.readdir('packages', 'utf-8');
            return [2, 'always', packageNames];
        },
    },
};
