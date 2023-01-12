import React from 'react';
import { CategoryScale, LinearScale, LineElement, BarElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import chroma from 'chroma-js';
import { TimeRange } from '@binocolo/common/types.js';
import { ColorTheme } from '../logic/themes.js';
import { MONOSPACE_FONT, REFERENCE_TEXT_SIZE } from '../logic/types.js';
import { HistogramData } from '../logic/models.js';
import { Chart as ChartJS, ChartOptions, ChartData } from 'chart.js';

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

export const EventsChart = ({
    colorTheme,
    histogramData,
    onChangeTimeRange,
    zoom,
    loading,
}: // incomplete,
{
    colorTheme: ColorTheme;
    histogramData: HistogramData;
    onChangeTimeRange: (timeRange: TimeRange) => void;
    zoom: number;
    loading: boolean;
    // incomplete: boolean;
}) => {
    if (histogramData.datasets.length > 1) {
        const data: ChartData<'line', (number | undefined)[], string> = {
            labels: histogramData.labels,
            datasets: histogramData.datasets.map(({ title, buckets, color }) => ({
                label: title,
                data: buckets.map((value) => (value !== null ? value : undefined)),
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
            })),
        };
        const options = buildLineGraphOptions({
            loading,
            colorTheme,
            histogramData,
            onChangeTimeRange,
            zoom,
        });
        return (
            <div style={{ backgroundColor: colorTheme.light.background }}>
                <Line options={options} data={data} />
            </div>
        );
    } else {
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
        const options = buildBarGraphOptions({
            loading,
            colorTheme,
            histogramData,
            onChangeTimeRange,
            zoom,
        });
        return (
            <div style={{ backgroundColor: colorTheme.light.background }}>
                <Bar options={options} data={data} />
            </div>
        );
    }
};

// function adjustDataValues(input: (number | null)[]): (number | null)[] {
//     let output: (number | null)[] = [];
//     let prevValue: number | null = null;
//     for (let idx = 0; idx < input.length; idx += 1) {
//         const value = input[idx];
//         if (idx > 0 && value === null && prevValue !== null) {
//             output.push(0);
//         } else {
//             output.push(value);
//         }
//         prevValue = value;
//     }
//     if (input.length > 0) {
//         output.push(prevValue);
//     }
//     return output;
// }

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
                display: true,
                position: 'right',
                labels: {
                    color: colorTheme.light.text,
                    borderRadius: 3,
                    font: {
                        family: MONOSPACE_FONT,
                    },
                    padding: 5,
                    generateLabels() {
                        return histogramData.datasets.map((dataset, idx) => ({
                            text: dataset.title,
                            datasetIndex: idx,
                            fillStyle: dataset.color,
                            borderRadius: 5,
                            lineCap: 'round',
                            lineWidth: 0.5,
                            fontColor: dataset.dimmed ? colorTheme.light.dimmedText : colorTheme.light.text,
                        }));
                        // return [
                        //     {
                        //         text: 'aa',
                        //     },
                        // ];
                    },
                    // usePointStyle: true,
                    // pointStyle: 'line',
                    // useBorderRadius: true,
                },
                onHover(evt, legendItem) {
                    // if (typeof legendItem.datasetIndex === 'number') {
                    //     console.log(histogramData.datasets[legendItem.datasetIndex].title);
                    // }
                },
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
