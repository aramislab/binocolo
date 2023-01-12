import { HighlightLevel, JSONBasicTypeName } from '@binocolo/common/common.js';
import chroma from 'chroma-js';

export type ColorTheme = {
    propertyInspectBackground: string;
    dark: RegionColorTheme;
    light: RegionColorTheme;
    types: { [k in JSONBasicTypeName]: string };
    popup: {
        datasource: string;
        background: string;
        header: string;
    };
    datasets: {
        normal: string;
        error: string;
        other: string[];
    };
};

export type RegionColorTheme = {
    background: string;
    lightBackground: string;
    lines: string;
    text: string;
    dimmedText: string;
    button: string;
    disabled: string;
    highlight: string;
    warning: string;
    highlightLevels: { [name in HighlightLevel]: string };
    distinctColors: string[];
};

export const DARK_THEME: ColorTheme = {
    propertyInspectBackground: '#1c1c1c',
    types: {
        string: '#33962a',
        number: '#d762a0',
        boolean: '#d0c765',
        null: '#d09b65',
    },
    popup: {
        datasource: '#d9cebf',
        background: '#dad6c4',
        header: '#9a9389',
    },
    dark: {
        background: '#000000',
        lightBackground: '#444444',
        highlight: '#262626',
        button: '',
        disabled: '',
        lines: '#656363',
        text: '#c7c7c7',
        dimmedText: '#797878',
        warning: '#c06d44',
        highlightLevels: {
            normal: '',
            warning: '',
            error: '#ff4848',
        },
        distinctColors: chroma.brewer.Paired,
    },
    light: {
        background: '#c4bdb9',
        lightBackground: '#ded8d4',
        highlight: '#dcc9a1',
        button: '#c9d5d5',
        disabled: '#969191',
        text: '#2c2a2a',
        dimmedText: '#504c4c',
        warning: '#e5580e',
        lines: '#b7adad',
        highlightLevels: {
            normal: '',
            warning: '',
            error: '',
        },
        distinctColors: [],
    },
    datasets: {
        normal: '#004c75',
        error: '#CE5538',
        other: [
            // Made using https://mokole.com/palette.html
            '#2f4f4f',
            '#a0522d',
            '#006400',
            '#000080',
            '#48d1cc',
            '#ff0000',
            '#ffa500',
            '#ffff00',
            '#00ff00',
            '#00fa9a',
            '#0000ff',
            '#d8bfd8',
            '#ff00ff',
            '#1e90ff',
            '#f0e68c',
            '#ff1493',
        ],
        // other: chroma.brewer.Paired, // https://gka.github.io/chroma.js/#chroma-brewer
    },
};

export const DEFAULT_COLOR_THEME = DARK_THEME;
