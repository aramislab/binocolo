import React from 'react';
import { CategoryScale, LinearScale, LineElement, BarElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import chroma from 'chroma-js';
import { TimeRange } from '@binocolo/common/types.js';
import { ColorTheme } from '../logic/themes.js';
import { MONOSPACE_FONT, REFERENCE_TEXT_SIZE, SERIF_FONT } from '../logic/types.js';
import { HistogramData, HistogramSeriesData, LogTableConfiguration } from '../logic/models.js';
import { Chart as ChartJS, ChartOptions, ChartData } from 'chart.js';
import styled from 'styled-components';
import { TextBlock } from './TextBlock.js';
import { config } from 'process';

// From: https://stackoverflow.com/a/38493678/225097
const backgroundColorPlugin = {
    id: 'backgroundColorPlugin',
    beforeDraw: function (chart: ChartJS) {
        let ctx = chart.ctx;
        let chartArea = chart.chartArea;
        ctx.save();
        ctx.fillStyle = chart.options.backgroundColor as string;
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.restore();
    },
};

ChartJS.register(
    CategoryScale,
    LinearScale,
    LineElement,
    BarElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    zoomPlugin,
    annotationPlugin,
    backgroundColorPlugin
);

function maxValue(values: (number | null)[]): number {
    return (values.filter((v) => v !== null) as number[]).reduce((a, b) => Math.max(a, b), 0);
}

type EventsChartParams = {
    config: LogTableConfiguration;
    histogramData: HistogramData;
    onChangeTimeRange: (timeRange: TimeRange) => void;
    zoom: number;
    loading: boolean;
    className?: string;
    histogramBreakdownProperty: string | null;
};

export const EventsChart = (params: EventsChartParams) => {
    if (params.histogramBreakdownProperty) {
        return <LineGraph {...params} />;
    } else {
        return <BarGraph {...params} />;
    }
};

const LineGraph = ({
    histogramData,
    onChangeTimeRange,
    zoom,
    loading,
    className,
    histogramBreakdownProperty,
    config,
}: EventsChartParams) => {
    const [highlighted, setHighlighted] = React.useState<HistogramSeriesData | null>(null);
    const [hovering, setHovering] = React.useState<HistogramSeriesData | null>(null);
    const [excluded, setExcluded] = React.useState<HistogramSeriesData[]>([]);
    const options = buildLineGraphOptions({
        loading,
        colorTheme: config.colorTheme,
        histogramData,
        onChangeTimeRange,
        zoom,
    });
    const data: ChartData<'line', (number | undefined)[], string> = {
        labels: histogramData.labels,
        datasets: histogramData.datasets
            .filter((dataSet) => (highlighted ? dataSet === highlighted : !excluded.includes(dataSet)))
            .map((dataSet) => {
                const color = highlighted || !hovering || hovering === dataSet ? dataSet.color : 'transparent';
                return {
                    label: dataSet.title,
                    data: dataSet.buckets.map((value) => (value !== null ? value : undefined)),
                    // data: adjustDataValues(buckets).map((value) => (value !== null ? value : undefined)),
                    // borderColor: chroma(color).darken().hex(),
                    borderColor: color,
                    backgroundColor: color,
                    stepped: false,
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    // tension: 0.2,
                    borderWidth: 1.5,
                    // pointStyle: 'rect',
                    pointBorderColor: color,
                    pointBackgroundColor: 'transparent',
                    pointRadius: 0,
                    pointHitRadius: 5,
                    // borderWidth: 0,
                };
            }),
    };
    return (
        <ChartContainerDiv colorTheme={config.colorTheme} className={className}>
            <div className="chart">
                <Line options={options} data={data} />
            </div>
            <div
                className="legend"
                onMouseOut={() => {
                    setHovering(null);
                }}
            >
                <div className="legend-title">
                    <div className="title">{histogramBreakdownProperty}:</div>
                    <TextBlock
                        config={config}
                        className="button"
                        theme={config.colorTheme.light}
                        button
                        onClick={() => {
                            config.setHistogramBreakdownProperty(null);
                        }}
                    >
                        Ungroup
                    </TextBlock>
                </div>
                {histogramData.datasets.map((dataSet, idx) => {
                    let modifier: string = '';
                    if (highlighted && highlighted === dataSet) {
                        modifier = 'highlighted';
                    } else if (excluded.includes(dataSet)) {
                        modifier = 'excluded';
                    } else if (highlighted && highlighted !== dataSet) {
                        modifier = 'dimmed';
                    }
                    return (
                        <div
                            key={idx}
                            className={`dataset ${modifier}`}
                            onClick={() => {
                                if (highlighted === dataSet) {
                                    setHighlighted(null);
                                    setExcluded(excluded.filter((ds) => ds !== dataSet).concat(dataSet));
                                    // if (excluded.includes(dataSet)) {
                                    // } else {
                                    //     setExcluded([...excluded].concat(dataSet));
                                    // }
                                } else if (excluded.includes(dataSet)) {
                                    setExcluded(excluded.filter((ds) => ds !== dataSet));
                                    setHighlighted(null);
                                } else {
                                    setExcluded(excluded.filter((ds) => ds !== dataSet));
                                    setHighlighted(dataSet);
                                }
                                setHovering(null);
                            }}
                            onMouseOver={() => {
                                if (!excluded.includes(dataSet)) {
                                    setHovering(dataSet);
                                }
                            }}
                        >
                            <div className="line" style={{ borderColor: dataSet.color }} />
                            <div className="title">{dataSet.title}</div>
                        </div>
                    );
                })}
            </div>
        </ChartContainerDiv>
    );
};

const BarGraph = ({ config, histogramData, onChangeTimeRange, zoom, loading, className }: EventsChartParams) => {
    const options = buildBarGraphOptions({
        loading,
        colorTheme: config.colorTheme,
        histogramData,
        onChangeTimeRange,
        zoom,
    });
    const data: ChartData<'bar', (number | undefined)[], string> = {
        labels: histogramData.labels,
        datasets: histogramData.datasets.map(({ title, buckets, color }) => ({
            label: title,
            data: buckets.map((value) => (value !== null ? value : undefined)),
            // data: adjustDataValues(buckets).map((value) => (value !== null ? value : undefined)),
            borderColor: chroma(color).darken().hex(),
            backgroundColor: color,
            stepped: true,
            fill: true,
            pointStyle: 'rect',
            pointBorderColor: 'transparent',
            pointBackgroundColor: 'transparent',
            pointRadius: 5,
            pointHitRadius: 5,
            borderWidth: 0,
        })),
    };
    return (
        <ChartContainerDiv colorTheme={config.colorTheme} className={className}>
            <div className="chart">
                <Bar options={options} data={data} />
            </div>
        </ChartContainerDiv>
    );
};

const ChartContainerDiv = styled.div<{ readonly colorTheme: ColorTheme }>`
    background-color: ${(props) => props.colorTheme.light.background};
    display: flex;

    .legend {
        min-width: 300px;
        background-color: ${(props) => props.colorTheme.light.lightBackground};
        border: 1px solid ${(props) => props.colorTheme.light.lines};
        padding: 10px;
        margin: 10px 0 0 0;
        display: flex;
        flex-direction: column;

        .legend-title {
            font-family: ${MONOSPACE_FONT};
            font-size: 14px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;

            .title {
            }

            .button {
                padding: 2px 5px;
            }
        }

        .dataset {
            display: flex;
            align-items: center;
            padding: 1px 5px;
            color: ${(props) => props.colorTheme.light.text};
            cursor: pointer;

            :hover {
                background-color: ${(props) => props.colorTheme.light.background};
            }

            .line {
                width: 20px;
                border-top: 4px solid black; // Color to be overridden via style properties
                border-radius: 2px;
                margin-right: 5px;
            }

            .title {
                font-family: ${MONOSPACE_FONT};
                font-size: 12px;
                user-select: none;
            }
        }

        .highlighted {
            font-weight: bold;
        }

        .dimmed {
            color: ${(props) => props.colorTheme.light.dimmedText};
            opacity: 0.7;
        }

        .excluded {
            color: ${(props) => props.colorTheme.light.dimmedText};
            opacity: 0.3;
        }
    }
`;

function buildLineGraphOptions({
    loading,
    colorTheme,
    histogramData,
    onChangeTimeRange,
    zoom,
}: {
    loading: boolean;
    colorTheme: ColorTheme;
    histogramData: HistogramData;
    onChangeTimeRange: (timeRange: TimeRange) => void;
    zoom: number;
}): ChartOptions<'line'> {
    const maxY = Math.max(maxValue(histogramData.datasets.map((dataset) => maxValue(dataset.buckets))), 1);
    return {
        animation: {
            easing: 'linear',
            duration: 100,
        },
        animations: {
            y: { duration: 100 },
            x: { duration: 0 },
        },
        backgroundColor: loading ? chroma(colorTheme.light.lightBackground).darken().hex() : colorTheme.light.lightBackground,
        transitions: {
            zoom: {
                animation: {
                    duration: 0,
                },
            },
        },
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: false,
            },
            tooltip: {
                animation: {
                    duration: 0.1,
                },
            },
            zoom: {
                zoom: {
                    onZoom({ chart }) {
                        const newTimeRange: TimeRange = {
                            start: histogramData.timestamps[chart.scales.x.min],
                            end: histogramData.timestamps[chart.scales.x.max],
                        };
                        chart.resetZoom();
                        onChangeTimeRange(newTimeRange);
                    },
                    drag: {
                        enabled: true,
                        backgroundColor: chroma(colorTheme.light.highlight).alpha(0.5).hex(),
                    },
                    mode: 'x',
                },
            },
            annotation: {
                annotations: {
                    // background: {
                    //     type: 'box',
                    //     xMin: 0,
                    //     xMax: histogramData.timestamps.length - 1,
                    //     yMin: 0,
                    //     yMax: maxY,
                    //     backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    // },
                    loading: loading
                        ? {
                              type: 'label',
                              xValue: histogramData.timestamps.length / 2,
                              yValue: (maxY / 3) * 2,
                              content: ['Loading data …'],
                              font: {
                                  size: REFERENCE_TEXT_SIZE * 1.5 * zoom,
                              },
                          }
                        : undefined,
                    // incomplete: incomplete
                    //     ? {
                    //           type: 'label',
                    //           xValue: histogramData.timestamps.length / 2,
                    //           yValue: (maxY / 3) * 2,
                    //           content: ['Results incomplete. Run smaller query on data source.'],
                    //           color: 'red',
                    //           font: {
                    //               size: REFERENCE_TEXT_SIZE * 1.5 * zoom,
                    //           },
                    //       }
                    //     : undefined,
                },
            },
        },
        aspectRatio: 6,
        responsive: true,
        scales: {
            y: {
                grid: {
                    color: colorTheme.light.lines,
                },
                ticks: {
                    color: colorTheme.light.text,
                    stepSize: maxY < 100 ? 1 : undefined,
                    font: {
                        size: REFERENCE_TEXT_SIZE * zoom,
                    },
                },
            },
            x: {
                grid: {
                    color: colorTheme.light.lines,
                },
                ticks: {
                    font: {
                        size: REFERENCE_TEXT_SIZE * zoom,
                    },
                    color: colorTheme.light.text,
                },
                // ticks: {
                //     callback: function (val, index) {
                //         return index % 4 === 0 ? this.getLabelForValue(val as any) : '';
                //     },
                // },
            },
        },
    };
}

function buildBarGraphOptions({
    loading,
    colorTheme,
    histogramData,
    onChangeTimeRange,
    zoom,
}: {
    loading: boolean;
    colorTheme: ColorTheme;
    histogramData: HistogramData;
    onChangeTimeRange: (timeRange: TimeRange) => void;
    zoom: number;
}): ChartOptions<'bar'> {
    const maxY = Math.max(maxValue(histogramData.datasets.map((dataset) => maxValue(dataset.buckets))), 1);
    return {
        animation: {
            easing: 'linear',
            duration: 100,
        },
        animations: {
            y: { duration: 100 },
            x: { duration: 0 },
        },
        backgroundColor: loading ? chroma(colorTheme.light.lightBackground).darken().hex() : colorTheme.light.lightBackground,
        transitions: {
            zoom: {
                animation: {
                    duration: 0,
                },
            },
        },
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: false,
            },
            tooltip: {
                animation: {
                    duration: 0.1,
                },
            },
            zoom: {
                zoom: {
                    onZoom({ chart }) {
                        const newTimeRange: TimeRange = {
                            start: histogramData.timestamps[chart.scales.x.min],
                            end: histogramData.timestamps[chart.scales.x.max],
                        };
                        chart.resetZoom();
                        onChangeTimeRange(newTimeRange);
                    },
                    drag: {
                        enabled: true,
                        backgroundColor: chroma(colorTheme.light.highlight).alpha(0.5).hex(),
                    },
                    mode: 'x',
                },
            },
            annotation: {
                annotations: {
                    // background: {
                    //     type: 'box',
                    //     xMin: 0,
                    //     xMax: histogramData.timestamps.length - 1,
                    //     yMin: 0,
                    //     yMax: maxY,
                    //     backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    // },
                    loading: loading
                        ? {
                              type: 'label',
                              xValue: histogramData.timestamps.length / 2,
                              yValue: (maxY / 3) * 2,
                              content: ['Loading data …'],
                              font: {
                                  size: REFERENCE_TEXT_SIZE * 1.5 * zoom,
                              },
                          }
                        : undefined,
                    // incomplete: incomplete
                    //     ? {
                    //           type: 'label',
                    //           xValue: histogramData.timestamps.length / 2,
                    //           yValue: (maxY / 3) * 2,
                    //           content: ['Results incomplete. Run smaller query on data source.'],
                    //           color: 'red',
                    //           font: {
                    //               size: REFERENCE_TEXT_SIZE * 1.5 * zoom,
                    //           },
                    //       }
                    //     : undefined,
                },
            },
        },
        aspectRatio: 8,
        responsive: true,
        scales: {
            y: {
                grid: {
                    color: colorTheme.light.lines,
                },
                ticks: {
                    color: colorTheme.light.text,
                    stepSize: maxY < 100 ? 1 : undefined,
                    font: {
                        size: REFERENCE_TEXT_SIZE * zoom,
                    },
                },
            },
            x: {
                grid: {
                    color: colorTheme.light.lines,
                },
                ticks: {
                    font: {
                        size: REFERENCE_TEXT_SIZE * zoom,
                    },
                    color: colorTheme.light.text,
                },
                // ticks: {
                //     callback: function (val, index) {
                //         return index % 4 === 0 ? this.getLabelForValue(val as any) : '';
                //     },
                // },
            },
        },
    };
}
