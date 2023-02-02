## (Rough) Release steps:

     npm version --commit-hooks false --git-tag-version false minor --workspaces

     npm run build

     npm run frontend:build-for-release

     npm run publish -- --workspaces