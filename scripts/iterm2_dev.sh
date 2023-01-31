#!/usr/bin/env bash

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"

ROOT_PATH="$( cd "${DIR}"/.. >/dev/null 2>&1 ; pwd -P )"
ENV_VERSIONS_DIR=~/Library/ApplicationSupport/iTerm2/iterm2env/versions
for FIRST_VERSION_DIR in ${ENV_VERSIONS_DIR}/*; do
  break
done
PYTHON_EXECUTABLE=$FIRST_VERSION_DIR/bin/python3

$PYTHON_EXECUTABLE - << END_PYTHON_SCRIPT

import iterm2


ROOT_DIR = '${ROOT_PATH}'


async def configure_session(session, title, dir, command):
    await session.async_send_text('export DISABLE_AUTO_TITLE="true"\n')
    await session.async_send_text('title {0}\n'.format(title))
    await session.async_send_text('cd {0}\n'.format(dir))
    await session.async_send_text('clear\n')
    await session.async_send_text('{0}\n'.format(command))


async def main(connection):
    app = await iterm2.async_get_app(connection)
    new_window = await app.current_terminal_window.async_create(connection)
    left_session = new_window.current_tab.current_session
    mid_session = await left_session.async_split_pane(vertical=True)
    right_session = await mid_session.async_split_pane(vertical=True)
    await configure_session(left_session, 'BUILD', ROOT_DIR, 'npm run watch')
    await configure_session(mid_session, 'FRONTEND', ROOT_DIR, 'npm run frontend:watch')
    await configure_session(right_session, 'BACKEND', ROOT_DIR, 'npm run cli:dev')


iterm2.run_until_complete(main)

END_PYTHON_SCRIPT