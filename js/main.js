const transition_period = 50;
const initial_period = 10;
const ai_activation_cycle = 748;
let currentCycle;
let forecasted;

function computeExtremum(cycle, initial_value, final_value) {
  const trans = transition_period + 1;
  const initial_limit = ai_activation_cycle + initial_period;
  const trans_limit = initial_limit + trans;

  if (cycle <= initial_limit) {
    return initial_value;
  } else if (cycle >= trans_limit) {
    return final_value;
  } else {
    const t = cycle - initial_limit;
    const res = (t * (final_value - initial_value) / trans) + initial_value;
    return res;
  }
}

function minimumRatio(cycle) {
  return computeExtremum(cycle, 0.045, 0.0025);
}

function maximumRatio(cycle) {
  return computeExtremum(cycle, 0.055, 0.1);
}

function stakedRatio(cycle, value) {
  return value;
}

function staticRate(cycle, value) {
  const stakedRatioValue = value;
  const staticRateValue = 1 / 1600 * (1 / (stakedRatioValue ** 2));
  return clip(staticRateValue, minimumRatio(cycle + 1), maximumRatio(cycle + 1));
}

function clip(value, min_value, max_value) {
  return Math.max(min_value, Math.min(value, max_value));
}

var tmp = 0;

function dyn(cycle, value, tmp1) {
  if (cycle <= ai_activation_cycle) {
    tmp = 0;
    return 0;
  }
  const previousBonus = tmp;
  const stakedRatioValue = tmp1;
  const secondsPerCycle = 245760;
  const ratioMax = maximumRatio(cycle + 1);
  const staticRateValue = staticRate(cycle, value);
  const staticRateDistToMax = ratioMax - staticRateValue;
  const udist = Math.max(0, Math.abs(stakedRatioValue - 0.5) - 0.02);
  const dist = stakedRatioValue >= 0.5 ? -udist : udist;
  const daysPerCycle = secondsPerCycle / 86400;
  const maxNewBonus = Math.min(staticRateDistToMax, 0.05);
  newBonus = previousBonus + dist * 0.01 * daysPerCycle;
  const res = clip(newBonus, 0, maxNewBonus);
  console.assert(res >= 0 && res <= 5);
  tmp = res;
  return res;
}

function adaptiveMaximum(r) {
  if (r >= 0.5) {
    return 0.01;
  }
  if (r <= 0.05) {
    return 0.1;
  }
  const y = (1 + 9 * Math.pow((50 - 100 * r) / 42, 2)) / 100;
  if (y>0.1)
	  return 0.1;
  else if (y<0.01)
	  return 0.01;
  else return y;

}

var tmp1;

function issuanceRate(cycle, value) {
  const adjustedCycle = cycle-2;
  tmp1 = value;
  const staticRateRatio = staticRate(cycle, value);
  const bonus = dyn(cycle, value, tmp1);
  const ratioMin = minimumRatio(adjustedCycle);
  ratioMax = maximumRatio(adjustedCycle);
  const totalRate = staticRateRatio + bonus;
  return clip(totalRate, ratioMin, ratioMax) * 100;
}

function issuanceRateQ(cycle, value) {
  const adjustedCycle = cycle-2;
  tmp1 = value;
  const staticRateRatio = staticRate(cycle, value);
  const bonus = dyn(cycle, value, tmp1);
  const ratioMin = minimumRatio(adjustedCycle);
  if (cycle>=813)
  ratioMax = Math.min(maximumRatio(adjustedCycle),adaptiveMaximum(value));
else
	ratioMax = maximumRatio(adjustedCycle);
  const totalRate = staticRateRatio + bonus;
  return clip(totalRate, ratioMin, ratioMax) * 100;
}

document.addEventListener('DOMContentLoaded', function() {
  function fetchCycleCount() {
    return fetch('https://api.tzkt.io/v1/cycles/count')
      .then(response => response.json());
  }

  function fetchCycleData(cycle) {
    return fetch(`https://kukai.api.tzkt.io/v1/statistics/cyclic?cycle=${cycle}`)
      .then(response => response.json());
  }

  function initializeRatios() {
    let ratios = [];
    let last = 0;

    return fetchCycleCount()
        .then(count => {
            currentCycle = count - 4;
            const startCycle = 748;
            const fetchPromises = [];

            for (let i = startCycle; i <= currentCycle; i++) {
                fetchPromises.push(fetchCycleData(i));
            }

            return Promise.all(fetchPromises);
        })
        .then(data => {
            data.forEach(cycleData => {
                const ratio = cycleData[0].totalFrozen / cycleData[0].totalSupply;
                ratios.push(ratio);
                last = ratio;
            });

            return exampleFetch();
        })
        .then(fetchedLast => {
            last = fetchedLast;
            ratios.push(last);

            while (ratios.length < 200) {
                last = last + slowIncrement(last, calculateAverageDifference(ratios));
                ratios.push(last);
            }

            forecasted = ratios[ratios.length - 1];
            return ratios;
        })
        .catch(error => {
            console.error('Error initializing ratios:', error);
        });
}

async function exampleFetch() {
    const response = await fetch('https://api.tzkt.io/v1/statistics/?sort.desc=level&limit=1');
    const json = await response.json();
    return json[0].totalFrozen / json[0].totalSupply;
}

function calculateAverageDifference(arr) {
    return arr.reduce((sum, val, idx, array) =>
        idx > 0 ? sum + Math.abs(val - array[idx - 1]) : sum, 0) / (arr.length - 1);
}

function slowIncrement(current, avgDiff) {
    const center = 0.5;
    const scale = 6; 
    return avgDiff * 0.8 / (1 + Math.exp((Math.abs(current - center) - center) / scale));
}


  function calculateIndicator(stakingRatio) {
    const idealRatio = 0.5;
    const k = 2;
    const indicator = 100 / (Math.exp(-k * (stakingRatio - idealRatio)));
    return parseInt(indicator>100?100:indicator);
  }

  let ratio;

  if (location.hash != "") {
    ratio = atob(location.hash.substring(1)).split(",");
    main(ratio);
  } else {
    initializeRatios()
      .then(ratios => {
        ratio = ratios;
        main(ratio);
      })
      .catch(error => {
        console.error('Error initializing ratios:', error);
      });
  }

  function main(ratio) {
    Highcharts.chart('issuance', {
      chart: {
        type: 'spline',
        backgroundColor: 'rgba(0,0,0,0)',
		events: {
            load: function() {
                const chart = this;
                const xAxis = chart.xAxis[0];
                const yAxis = chart.yAxis[0];
                
                const dataPoint = chart.series[0].data.find(point => point.x === currentCycle + 1);
                const dataPoint2 = chart.series[0].data.find(point => point.x === 803);
                if (dataPoint) {
                    const yValue = dataPoint.y;
                    
                    const xPos = xAxis.toPixels(currentCycle + 1);
                    const yPosTop = yAxis.toPixels(yValue);
                    const yPosBottom = yAxis.toPixels(0);

                    chart.renderer.path(['M', xPos, yPosTop, 'L', xPos, yPosBottom])
                        .attr({
                            'stroke-width': 0.5,
                            stroke: '#ffffff',
                        })
                        .add();
                }
				if (dataPoint2) {
                    const yValue = dataPoint.y;
                    
                    const xPos = xAxis.toPixels(803);
                    const yPosTop = yAxis.toPixels(yValue);
                    const yPosBottom = yAxis.toPixels(0);

                    chart.renderer.path(['M', xPos, yPosTop, 'L', xPos, yPosBottom])
                        .attr({
                            'stroke-width': 0.5,
                            stroke: '#ffffff',
                        })
                        .add();
                }
            }
        }
      },
      title: {
        text: 'Issuance (excl. LB)',
        style: {
          color: '#ffffff'
        }
      },
      xAxis: {
        lineColor: '#ffffff',
        labels: {
            formatter: function() {
                if (this.value === currentCycle+1) {
                    return 'Now';
                }
				else if (this.value == 813) {
                    return 'Quebec';
                }
				else
                return '';
            },
            style: {
                color: '#ffffff'
            }
        },
        title: {
          text: null
        },
        tickInterval: 1,
		tickPositions: [currentCycle+1,804]
      },
      yAxis: {
        labels: {
          enabled: false
        },
        gridLineWidth: 0,
        title: {
          text: null
        },
        min: 0,
        max: 11,
        tickInterval: 1
      },
      tooltip: {
        formatter: function() {
          const cycle = this.x;
          const seriesName = this.series.name;
          const originalYValue = this.y;
          const modifiedYValue = (originalYValue).toFixed(2) + "%";
          return `Cycle: ${cycle}<br><span style="color:${this.point.color}">●</span> ${seriesName}: <b>${modifiedYValue}</b><br/>`;
        }
      },
      series: [{
	zoneAxis: 'x',
        zones: [{
          value: (currentCycle+1)
        }, {
          dashStyle: 'ShortDot'
        }],
        showInLegend: false,
        shadow: {
          color: 'rgba(255, 255, 0, 0.7)',
          offsetX: 0,
          offsetY: 0,
          opacity: 1,
          width: 10
        },
        color: {
          linearGradient: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 1
          },
          stops: [
            [0, '#ff6961'],
            [1, '#77dd77']
          ]
        },
        name: 'Issuance',
        data: ratio.map((value, index) => {
	const xValue = index + 748;
	const yValue = issuanceRate(xValue, value);
	const adjustedYValue = yValue;
	return {
        x: xValue,
        y: adjustedYValue
	};}),
        lineWidth: 3,
        dataLabels: {
          enabled: true,
          formatter: function() {
            if (this.point.index === this.series.data.length - 1) {
              return `${(this.y).toFixed(2) + "% (P)"}`;
            }
			else if (this.point.x == currentCycle+1) {
              return `${(this.y).toFixed(2) + "%"}`;
            }
			else
            return null;
          },
          align: 'right',
          verticalAlign: 'bottom',

        },
        marker: {
          enabled: false
        },
      },
	  
	  {
	zoneAxis: 'x',
        zones: [{
          value: (currentCycle+1)
        }, {
          dashStyle: 'ShortDot'
        }],
        showInLegend: false,
        shadow: {
          color: 'rgba(255, 255, 0, 0.7)',
          offsetX: 0,
          offsetY: 0,
          opacity: 1,
          width: 10
        },
        color: {
          linearGradient: {
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 1
          },
          stops: [
            [0, '#ff6961'],
            [1, '#77dd77']
          ]
        },
        name: 'Issuance',
        data: ratio.map((value, index) => {
	const xValue = index + 748;
	const yValue = issuanceRateQ(xValue, value);
	const adjustedYValue = yValue + 0.0625 * yValue;
	return {
        x: xValue,
        y: adjustedYValue
	};}),
        lineWidth: 3,
        dataLabels: {
          enabled: true,
          formatter: function() {
            if (this.point.index === this.series.data.length - 1) {
              return `${(this.y).toFixed(2) + "% (Quebec)"}`;
            }
			else if (this.point.x == currentCycle+1) {
              return `${(this.y).toFixed(2) + "%"}`;
            }
			else
            return null;
          },
          align: 'right',
          verticalAlign: 'bottom',

        },
        marker: {
          enabled: false
        },
      }
	  ],
      credits: {
        enabled: false
      }
    });

    function updateIssuanceChart(newStakingData) {
    const issuanceData = newStakingData.map(point => {
        const xValue = point.x;
        const yValue = issuanceRate(xValue, point.y);
        const adjustedYValue = yValue; // Adjust y value
        return {
            x: xValue,
            y: adjustedYValue
        };
    });
	
	const issuanceDataQ = newStakingData.map(point => {
        const xValue = point.x;
        const yValue = issuanceRateQ(xValue, point.y);
        const adjustedYValue = yValue + 0.0625 * yValue; // Adjust y value
        return {
            x: xValue,
            y: adjustedYValue
        };
    });

    Highcharts.charts.forEach(chart => {
        if (chart.renderTo.id === 'issuance') {
            chart.series[0].setData(issuanceData, true);
			chart.series[1].setData(issuanceDataQ, true);
        }
    });
	}

    Highcharts.chart('stake', {
      chart: {
        type: 'spline',
        backgroundColor: 'rgba(0,0,0,0)',
		events: {
            load: function() {
                const chart = this;
                const xAxis = chart.xAxis[0];
                const yAxis = chart.yAxis[0];
                
                const dataPoint = chart.series[0].data.find(point => point.x === currentCycle + 1);
                
                if (dataPoint) {
                    const yValue = dataPoint.y;
                    
                    const xPos = xAxis.toPixels(currentCycle + 1);
                    const yPosTop = yAxis.toPixels(yValue);
                    const yPosBottom = yAxis.toPixels(0);

                    chart.renderer.path(['M', xPos, yPosTop, 'L', xPos, yPosBottom])
                        .attr({
                            'stroke-width': 0.5,
                            stroke: '#ffffff',
                        })
                        .add();
                }
            }
        }
      },
      title: {
        style: {
          color: '#ffffff'
        },
        text: 'Locked supply'
      },
      xAxis: {
        labels: {
            formatter: function() {
                if (this.value === currentCycle+1) {
                    return 'Now';
                }
                return '';
            },
            style: {
                color: '#ffffff'
            }
        },
        lineColor: '#ffffff',
        title: {
            text: null
        },
        tickPositions: [currentCycle+1],
        tickInterval: 1,
    },
      yAxis: {
        labels: {
          enabled: false
        },
        lineColor: '#ffffff',
        gridLineWidth: 0,
        title: {
          text: null
        },
        min: 0,
        max: 1,
        tickInterval: 0.2
      },
      tooltip: {
        formatter: function() {
          const cycle = this.x;
          const seriesName = this.series.name;
          const originalYValue = this.y;
          const modifiedYValue = (originalYValue * 100).toFixed(2) + "%";
          return `Cycle: ${cycle}<br><span style="color:${this.point.color}">●</span> ${seriesName}: <b>${modifiedYValue}</b><br/>`;
        }
      },
      series: [{
        zoneAxis: 'x',
        zones: [{
          value: (currentCycle+1)
        }, {
          dashStyle: 'ShortDot'
        }],
        shadow: {
          color: 'rgba(255, 255, 0, 0.7)',
          offsetX: 0,
          offsetY: 0,
          opacity: 1,
          width: 10
        },
        name: "Staking ratio",
        showInLegend: false,
        data: ratio.map((value, index) => ({
          x: index + 748,
          y: stakedRatio(index + 1, value)
        })),
        dataLabels: {
          enabled: true,
          formatter: function() {
            if (this.point.index === this.series.data.length - 1) {
              return `${(this.y * 100).toFixed(2) + "%"}`;
            }
			else if (this.point.x == currentCycle+1) {
              return `${(this.y * 100).toFixed(2) + "%"}`;
            }
			else
            return null;
          },
          align: 'right',
          verticalAlign: 'bottom',

        },
        lineWidth: 3,
        marker: {
          enabled: false
        },
      }],
      credits: {
        enabled: false
      },
      plotOptions: {
        series: {
          color: {
            linearGradient: {
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 1
            },
            stops: [
              [0, '#77dd77'],
              [1, '#ff6961']
            ]
          },
          stickyTracking: true,
          dragDrop: {
            draggableY: true,
            dragMaxY: 1,
            dragMinY: 0,
            liveRedraw: true
          },
          point: {
            events: {
              drag: function(e) {
                const point = e.target;
				if (point.x<=currentCycle+1)
				{
					e.newPoint.y=point.y;
					return;
				}
                const newValue = e.newPoint.y;
                const series = point.series;
                const updatedData = series.data.map((p, i) => ({
                  x: p.x,
                  y: i >= point.index ? parseFloat(newValue) : p.y
                }));
                series.setData(updatedData, true, {
                  duration: 800,
                  easing: 'easeOutBounce'
                });
                updateIssuanceChart(updatedData);
              }
            }
          }
        }
      }
    });

    // New Chart Code
    fetch('https://api.tzpro.io/series/block?columns=time,n_funded_accounts,n_cleared_accounts&end_date=now&fill=none&collapse=1M&limit=75', {
      headers: {
        'X-Api-Key': 'JK6F9IDTM330VW6O8W0303JPVLEY57Z',
        'Content-Type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(data => {
        const fundedSeries = data.map(item => ({
          x: new Date(item[0]).getTime(),
          y: item[1]
        }));

        const clearedSeries = data.map(item => ({
          x: new Date(item[0]).getTime(),
          y: -item[2]
        }));

        Highcharts.chart('chart-container4', {
          chart: {
            type: 'column',
            backgroundColor: 'rgba(0,0,0,0)'
          },
          title: {
            text: 'Funded/Cleared accounts',
            style: {
              color: '#ffffff'
            }
          },
          xAxis: {
            lineColor: '#ffffff',
            labels: {
              enabled: false
            },
            type: 'datetime',
            title: {
              text: null,
              style: {
                color: '#ffffff'
              }
            }
          },
          yAxis: {
            gridLineWidth: 0,
            labels: {
              enabled: false
            },
            title: {
              text: null,
              style: {
                color: '#ffffff'
              }
            },
            gridLineColor: '#444444'
          },
          series: [
            {
              showInLegend: false,
              shadow: {
                color: 'rgba(255, 255, 0, 0.7)',
                offsetX: 0,
                offsetY: 0,
                opacity: 1,
                width: 10
              },
              name: 'Funded Accounts',
              data: fundedSeries,
              color: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1
                },
                stops: [
                  [0, '#77dd77'],
                  [1, '#77dd77']
                ]
              },
              borderWidth: 0
            },
            {
              showInLegend: false,
              shadow: {
                color: 'rgba(255, 255, 0, 0.7)',
                offsetX: 0,
                offsetY: 0,
                opacity: 1,
                width: 10
              },
              name: 'Cleared Accounts',
              data: clearedSeries,
              color: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1
                },
                stops: [
                  [0, '#ff6961'],
                  [1, '#ff6961']
                ]
              },
              borderWidth: 0
            }
          ],
          credits: {
            enabled: false
          }
        });
      })
      .catch(error => {
        console.error('Error fetching account data:', error);
      });

    Highcharts.chart('chart-container5', {
      chart: {
        type: 'gauge',
        plotBackgroundColor: null,
        plotBackgroundImage: null,
        plotBorderWidth: 0,
        plotShadow: true, // Set plotShadow to false for no shadow
        backgroundColor: 'rgba(0,0,0,0)', // Transparent background
      },

      title: {
        text: 'TezBullMeter',
        style: {
          color: '#ffffff' // Title text color
        }
      },
      subtitle: {
        text: '', // Text for the subtitle
        style: {
          fontSize: '0.75em', // Adjust the font size of the subtitle
          color: '#ffffff' // Optionally adjust the color of the subtitle text
        }
      },

      pane: {
        startAngle: -90,
        endAngle: 89.9,
        background: null,
        center: ['50%', '75%'],
      },

      // the value axis
      yAxis: {
        min: 0,
        max: 100,
        tickPixelInterval: 72,
        tickPosition: 'inside',
        tickColor: '#ffffff', // Tick color
        tickLength: 20,
        tickWidth: 2,
        minorTickInterval: null,
        labels: {
          distance: 20,
          style: {
            fontSize: '14px',
            color: '#ffffff' // Label text color
          }
        },
        lineWidth: 0,
        plotBands: [{
          from: 0,
          to: 40,
          color: '#DF5353', // Red color
          thickness: 20,
          borderRadius: '50%'
        }, {
          from: 65,
          to: 100,
          color: '#55BF3B', // Green color
          thickness: 20,
          borderRadius: '50%'
        }, {
          from: 30,
          to: 70,
          color: '#DDDF0D', // Yellow color
          thickness: 20,
        }]
      },

      series: [{
        name: '',
        data: [calculateIndicator(forecasted)],
        tooltip: {
          valueSuffix: '% Moon'
        },
        dataLabels: {
          format: '{y}% Moon',
          borderWidth: 0,
          color: '#ffffff', // Data label text color
          style: {
            fontSize: '16px'
          }
        },
        dial: {
          radius: '80%',
          backgroundColor: 'gray',
          baseWidth: 12,
          baseLength: '0%',
          rearLength: '0%'
        },
        pivot: {
          backgroundColor: 'gray',
          radius: 6
        }
      }],
      credits: {
        enabled: false
      }

    });

    fetch('https://stats.dipdup.net/v1/histogram/balance_update/sum/month?field=Update&Kind=2&size=1000')
      .then(response => response.json())
      .then(data => {
        var seriesData = [];
        var cumulativeSum = 0;

        data.reverse().forEach(item => {
          var value = Math.abs(parseInt(item.value) / 1000000);
          cumulativeSum += value;
          cumulativeSum = parseFloat(cumulativeSum.toFixed(6));
          seriesData.push([new Date(item.ts * 1000).getTime(), cumulativeSum]);
        });

        seriesData.reverse();

        Highcharts.chart('chart-container', {
          chart: {
            type: 'spline',
            backgroundColor: 'rgba(0,0,0,0)'
          },
          title: {
            text: 'Burned Supply',
            style: {
              color: '#ffffff'
            }
          },
          xAxis: {
            type: 'datetime',
            lineColor: '#ffffff',
            lineWidth: 1,
            labels: {
              enabled: false
            }
          },
          yAxis: {
            gridLineWidth: 0,
            title: {
              text: null
            },
            labels: {
              enabled: false
            }
          },
          plotOptions: {
            series: {
              marker: {
                enabled: false
              },
              lineWidth: 2,
              states: {
                hover: {
                  lineWidthPlus: 0
                }
              },
              color: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1
                },
                stops: [
                  [0, '#77dd77'],
                  [1, '#ff6961']
                ]
              }
            }
          },
          exporting: {
            enabled: false
          },
          series: [{
            showInLegend: false,
            shadow: {
              color: 'rgba(255, 255, 0, 0.7)',
              offsetX: 0,
              offsetY: 0,
              opacity: 1,
              width: 10
            },
            name: 'Burned Supply',
            data: seriesData,
            dataLabels: {
              enabled: true,
              formatter: function() {
                if (this.point.index === 0) {
                  return `${(this.y / 1000000).toFixed(2) + "M"}`;
                }
                return null;
              },
              align: 'right',
              verticalAlign: 'bottom',

            },
          }],
          credits: {
            enabled: false
          }
        });
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });

    fetch('https://stats.dipdup.net/v1/histogram/accounts_stats/max/week?field=Total&size=1000')
      .then(response => response.json())
      .then(data => {
        var seriesData = [];
        var cumulativeSum = 0;

        data.reverse().forEach(item => {
          var value = Math.abs(parseInt(item.value));
          seriesData.push([new Date(item.ts * 1000).getTime(), value]);
        });

        seriesData.reverse();

        Highcharts.chart('chart-container2', {
          chart: {
            type: 'spline',
            backgroundColor: 'rgba(0,0,0,0)'
          },
          title: {
            text: 'Total Accounts',
            style: {
              color: '#ffffff'
            }
          },
          xAxis: {
            type: 'datetime',
            lineColor: '#ffffff',
            lineWidth: 1,
            labels: {
              enabled: false
            }
          },
          yAxis: {
            gridLineWidth: 0,
            title: {
              text: null
            },
            labels: {
              enabled: false
            }
          },
          plotOptions: {
            series: {
              marker: {
                enabled: false
              },
              lineWidth: 2,
              states: {
                hover: {
                  lineWidthPlus: 0
                }
              },
              color: {
                linearGradient: {
                  x1: 0,
                  y1: 0,
                  x2: 0,
                  y2: 1
                },
                stops: [
                  [0, '#77dd77'],
                  [1, '#ff6961']
                ]
              }
            }
          },
          exporting: {
            enabled: false
          },
          series: [{
            showInLegend: false,
            shadow: {
              color: 'rgba(255, 255, 0, 0.7)',
              offsetX: 0,
              offsetY: 0,
              opacity: 1,
              width: 10
            },
            name: 'Total Accounts',
            data: seriesData,
            dataLabels: {
              enabled: true,
              formatter: function() {
                if (this.point.index === 0) {
                  return `${(this.y / 1000000).toFixed(2) + "M"}`;
                }
                return null;
              },
              align: 'right',
              verticalAlign: 'bottom',

            }
          }],
          credits: {
            enabled: false
          }
        });
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }
});
