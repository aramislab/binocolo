# binocolo

// TODO: Say something intelligent here that explains what this project is about.


## For Developers

Initial setup and first-time installation of dependencies:

```
nvm install && nvm use  # install required Node.js version and use it
npm install             # install all the dependencies, including deps of workspace "packages"
```

First build:

```
npm run build
npm run build --workspace packages/cli-frontend
npm run copy-frontend-bundle
```

Add a local data source:

```
npm run cli --workspace packages/cli -- addDataSource
```

Answer the questions:
- Unique ID: cloud-production
- Name to display in the UI: Cloud (production)
- AWS Region: us-east-1
- Log Group name: convox-prod-cloud-gen2-LogGroup-WQBa068I8II9

These settings will be saved to `~/Library/Preferences/binocolo-nodejs/config.json` on a Mac.


Run a local server to see the logs:

```
npm run cli --workspace packages/cli -- runServer
```

This should open a new browser window at http://127.0.0.1:32652.
