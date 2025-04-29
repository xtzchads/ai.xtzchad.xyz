document.addEventListener('DOMContentLoaded', function () {
  fetchCycleData().then(data => {
    const processed = processIssuanceData(data);
    currentCycle = processed.currentCycle;
    main(processed.ratios);
  });

  function fetchCycleData() {
    return fetch(`https://kukai.api.tzkt.io/v1/statistics/cyclic?limit=10000`)
      .then(response => response.json());
  }

  function processIssuanceData(data) {

    const ratios = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];

      const prevSupply = parseFloat(prev.totalSupply);
      const currSupply = parseFloat(curr.totalSupply);

      const supplyDiff = currSupply - prevSupply;
      const growthRate = supplyDiff / prevSupply;

      const timeDiffSec = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;

      const secondsInYear = 365.25 * 24 * 60 * 60;
      const annualized = (growthRate * (secondsInYear / timeDiffSec)) * 100;

      ratios.push({
        cycle: curr.cycle,
        issuance: annualized
      });
    }

    return {
      ratios,
      currentCycle: data[data.length - 1].cycle
    };
  }

  function main(ratioData) {
    Highcharts.chart('issuance', {
      chart: {
        type: 'spline',
        backgroundColor: 'rgba(0,0,0,0)',
        events: {
            load: function() {
                const chart = this;
                const xAxis = chart.xAxis[0];
                const yAxis = chart.yAxis[0];
                
                const dataPoint = chart.series[0].data.find(point => point.x === 428);
                if (dataPoint) {
                    const yValue = dataPoint.y;
                    
                    const xPos = xAxis.toPixels(428);
                    const yPosTop = yAxis.toPixels(yValue);
                    const yPosBottom = yAxis.toPixels(0);

                    chart.renderer.path(['M', xPos, yPosTop, 'L', xPos, yPosBottom])
                        .attr({
                            'stroke-width': 0.5,
                            stroke: '#ffffff',
                        })
                        .add();
                }
              const dataPoint2 = chart.series[0].data.find(point => point.x === 748);
                if (dataPoint2) {
                    const yValue = dataPoint.y;
                    
                    const xPos = xAxis.toPixels(748);
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
        text: 'Issuance',
        style: {
          color: '#ffffff'
        }
      },
      xAxis: {
        lineColor: '#ffffff',
        labels: {
          formatter: function () {
            if (this.value === 428) {
              return 'Hangzhou';
            }
            else if (this.value === 748) {
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
        formatter: function () {
          return `Cycle: ${this.x}<br><span style="color:${this.point.color}">●</span> Issuance: <b>${this.y.toFixed(2)}%</b><br/>`;
        }
      },
      series: [{
        zoneAxis: 'x',
        showInLegend: false,
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
        data: ratioData.map(d => ({
          x: d.cycle,
          y: d.issuance
        })),
        lineWidth: 3,
        dataLabels: {
          enabled: true,
          formatter: function () {
            if (this.point.index === this.series.data.length - 1 || this.point.x === currentCycle + 1) {
              return `${this.y.toFixed(2)}%`;
            }
            return null;
          },
          align: 'right',
          verticalAlign: 'bottom',
        },
        marker: {
          enabled: false
        },
      }],
      credits: {
        enabled: false
      }
    });
  }
});
