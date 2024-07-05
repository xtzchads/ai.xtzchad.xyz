const transition_period = 50;
const initial_period = 10;
const ai_activation_cycle = 748;

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

var tmp1;

function issuanceRate(cycle, value) {
  const adjustedCycle = cycle;
  tmp1 = value;
  const staticRateRatio = staticRate(cycle, value);
  const bonus = dyn(cycle, value, tmp1);
  const ratioMin = minimumRatio(adjustedCycle);
  const ratioMax = maximumRatio(adjustedCycle);
  const totalRate = staticRateRatio + bonus;
  return clip(totalRate, ratioMin, ratioMax) * 100;
}

document.addEventListener('DOMContentLoaded', function () {
  function fetchCycleCount() {
    return fetch('https://api.tzkt.io/v1/cycles/count')
      .then(response => response.json());
  }

  function fetchCycleData(cycle) {
    return fetch(`https://api.tzkt.io/v1/statistics/cyclic?cycle=${cycle}`)
      .then(response => response.json());
  }

  function initializeRatios() {
    let cycleCount;
    return fetchCycleCount()
      .then(count => {
        cycleCount = count;
        const currentCycle = cycleCount - 4;
        const startCycle = 748;
        let ratios = [];
        let last = 0;

        const fetchPromises = [];

        for (let i = startCycle; i <= currentCycle; i++) {
          fetchPromises.push(fetchCycleData(i));
        }

        return Promise.all(fetchPromises);
      })
      .then(data => {
        let ratios = [];
        let last = 0;
        data.forEach(cycleData => {
          const ratio = cycleData[0].totalFrozen / cycleData[0].totalSupply;
          ratios.push(ratio);
          last = ratio;
        });

        while (ratios.length < 100) {
          ratios.push(last);
        }
        return ratios;
      });
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
        backgroundColor: 'rgba(0,0,0,0)'
      },
      title: {
        text: 'Issuance',
        style: {
          color: '#ffffff'
        }
      },
      xAxis: {
        lineColor: '#ffffff',
        labels: {
          enabled: false
        },
        title: {
          text: null
        },
        tickInterval: 1
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
      series: [{
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
        data: ratio.map((value, index) => ({
          x: index + 748,
          y: issuanceRate(index + 748, value)
        })),
        lineWidth: 3,
        marker: {
          enabled: false
        },
      }],
      credits: {
        enabled: false
      }
    });

    function updateIssuanceChart(newStakingData) {
      const issuanceData = newStakingData.map((value, index) => ({
        x: value.x,
        y: issuanceRate(value.x, value.y)
      }));

      Highcharts.charts.forEach(chart => {
        if (chart.renderTo.id === 'issuance') {
          chart.series[0].setData(issuanceData, true);
        }
      });
    }

    Highcharts.chart('stake', {
      chart: {
        type: 'spline',
        backgroundColor: 'rgba(0,0,0,0)'
      },
      title: {
        style: {
          color: '#ffffff'
        },
        text: 'Stake (Drag points to customize)'
      },
      xAxis: {
        labels: {
          enabled: false
        },
        lineColor: '#ffffff',
        title: {
          text: null
        },
        tickInterval: 1
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
      series: [{
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
          stickyTracking: false,
          dragDrop: {
            draggableY: true,
            dragMaxY: 1,
            dragMinY: 0,
            liveRedraw: true
          },
          point: {
            events: {
              drag: function (e) {
                const point = e.target;
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

    fetch('https://stats.dipdup.net/v1/histogram/balance_update/sum/month?field=Update&Kind=2&size=1000')
      .then(response => response.json())
      .then(data => {
        var seriesData = [];
        var cumulativeSum = 0;

        data.reverse().forEach(item => {
          var value = Math.abs(parseInt(item.value) / 1000000);
          cumulativeSum += value;
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
            data: seriesData
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