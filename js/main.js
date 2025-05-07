// Core constants
const TRANSITION_PERIOD = 50;
const INITIAL_PERIOD = 10;
const AI_ACTIVATION_CYCLE = 748;

// State variables
let currentCycle, forecasted, tmp = 0, tmp1;

// Core calculation functions
function computeExtremum(cycle, initialValue, finalValue) {
  const initialLimit = AI_ACTIVATION_CYCLE + INITIAL_PERIOD;
  const transLimit = initialLimit + TRANSITION_PERIOD + 1;
  
  if (cycle <= initialLimit) return initialValue;
  if (cycle >= transLimit) return finalValue;
  
  const t = cycle - initialLimit;
  return (t * (finalValue - initialValue) / (TRANSITION_PERIOD + 1)) + initialValue;
}

function minimumRatio(cycle) { return computeExtremum(cycle, 0.045, 0.0025); }
function maximumRatio(cycle) { return computeExtremum(cycle, 0.055, 0.1); }
function stakedRatio(cycle, value) { return value; }
function clip(value, minValue, maxValue) { return Math.max(minValue, Math.min(value, maxValue)); }

function staticRate(cycle, value) {
  const staticRateValue = 1 / 1600 * (1 / (value ** 2));
  return clip(staticRateValue, minimumRatio(cycle + 1), maximumRatio(cycle + 1));
}

function applyBonus(cycle, value, targetRatio, tmp1) {
  if (cycle <= AI_ACTIVATION_CYCLE) {
    tmp = 0;
    return 0;
  }
  
  const previousBonus = tmp;
  const stakedRatioValue = tmp1;
  const ratioMax = maximumRatio(cycle + 1);
  const staticRateValue = staticRate(cycle, value);
  const staticRateDistToMax = ratioMax - staticRateValue;
  const udist = Math.max(0, Math.abs(stakedRatioValue - targetRatio) - 0.02);
  const dist = stakedRatioValue >= targetRatio ? -udist : udist;
  const maxNewBonus = Math.min(staticRateDistToMax, 0.05);
  const newBonus = previousBonus + dist * 0.01 * (cycle==858)?(245760 / 86400):1;
  const res = clip(newBonus, 0, maxNewBonus);
  
  console.assert(res >= 0 && res <= 5);
  tmp = res;
  return res;
}

function dyn(cycle, value, tmp1) {
  return applyBonus(cycle, value, 0.5, tmp1);
}

function dyn2(cycle, value, tmp1) {
  return applyBonus(cycle, value, 0.4, tmp1);
}

function adaptiveMaximum(r) {
  if (r >= 0.5) return 0.01;
  if (r <= 0.05) return 0.1;
  
  const y = (1 + 9 * Math.pow((50 - 100 * r) / 42, 2)) / 100;
  return clip(y, 0.01, 0.1);
}

function issuanceRateQ(cycle, value) {
  const adjustedCycle = cycle - 2;
  tmp1 = value;
  const staticRateRatio = staticRate(cycle, value);
  const bonus = dyn(cycle, value, tmp1);
  const ratioMin = minimumRatio(adjustedCycle);
  const ratioMax = cycle >= 823 ? 
    Math.min(maximumRatio(adjustedCycle), adaptiveMaximum(value)) : 
    maximumRatio(adjustedCycle);
  
  const totalRate = staticRateRatio + bonus;
  return clip(totalRate, ratioMin, ratioMax) * 100;
}

function calculateIndicator(stakingRatio) {
  const indicator = 100 / (Math.exp(-2 * (stakingRatio - 0.5)));
  return parseInt(Math.min(indicator, 100));
}

// Data fetching functions
function fetchHistoricalCycleData() {
  return fetch(`https://kukai.api.tzkt.io/v1/statistics/cyclic?limit=10000`)
    .then(response => response.json());
}

async function getCurrentStakingRatio() {
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
  return avgDiff * 0.4 / (1 + Math.exp((Math.abs(current - center) - center) / scale));
}

// Initialize ratios using the historical data
function initializeRatios() {
  let ratios = [];
  let last = 0;

  return fetchHistoricalCycleData()
    .then(data => {
      currentCycle = data[data.length - 1].cycle;
      const startCycle = AI_ACTIVATION_CYCLE;
      
      // Filter data from AI activation cycle onward
      const relevantData = data.filter(cycleData => cycleData.cycle >= startCycle);
      
      relevantData.forEach(cycleData => {
        const ratio = cycleData.totalFrozen / cycleData.totalSupply;
        ratios.push(ratio);
        last = ratio;
      });
      
      return getCurrentStakingRatio();
    })
    .then(fetchedLast => {
      last = fetchedLast;
      ratios.push(last);

      // Generate forecasted data up to 495 points if needed
      while (ratios.length < 495) {
        last += slowIncrement(last, calculateAverageDifference(ratios));
        ratios.push(last);
      }

      forecasted = ratios[ratios.length - 1];
      return ratios;
    })
    .catch(error => console.error('Error initializing ratios:', error));
}

// Chart creation functions
function createVerticalLine(chart, xValue) {
  const xAxis = chart.xAxis[0];
  const yAxis = chart.yAxis[0];
  
  const dataPoint = chart.series[0].data.find(point => point.x === xValue);
  if (dataPoint) {
    const xPos = xAxis.toPixels(xValue);
    const yPosTop = yAxis.toPixels(dataPoint.y);
    const yPosBottom = yAxis.toPixels(0);

    chart.renderer.path(['M', xPos, yPosTop, 'L', xPos, yPosBottom])
      .attr({
        'stroke-width': 0.5,
        stroke: '#ffffff',
      })
      .add();
  }
}

function createVerticalLines(chart, positions) {
  positions.forEach(pos => createVerticalLine(chart, pos));
}

function createIssuanceChart(ratio) {
  return Highcharts.chart('issuance', {
    chart: {
      type: 'spline',
      backgroundColor: 'rgba(0,0,0,0)',
      events: {
        load: function() { createVerticalLine(this, currentCycle + 1); }
      }
    },
    title: {
      text: 'Issuance since Paris',
      style: { color: '#ffffff' }
    },
    xAxis: {
      lineColor: '#ffffff',
      labels: {
        formatter: function() {
          return this.value === currentCycle + 1 ? 'Now' : '';
        },
        style: { color: '#ffffff' }
      },
      title: { text: null },
      tickInterval: 1,
      tickPositions: [currentCycle + 1, 823]
    },
    yAxis: {
      labels: { enabled: false },
      gridLineWidth: 0,
      title: { text: null },
      min: 0, max: 11,
      tickInterval: 1
    },
    tooltip: {
      formatter: function() {
        return `Cycle: ${this.x}<br><span style="color:${this.point.color}">●</span> ${this.series.name}: <b>${this.y.toFixed(2)}%</b><br/>`;
      }
    },
    series: [{
      zoneAxis: 'x',
      zones: [{ value: (currentCycle + 1) }, { dashStyle: 'ShortDot' }],
      showInLegend: false,
      shadow: {
        color: 'rgba(255, 255, 0, 0.7)',
        offsetX: 0, offsetY: 0,
        opacity: 1, width: 10
      },
      color: {
        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
        stops: [[0, '#ff6961'], [1, '#77dd77']]
      },
      name: 'Issuance',
      data: ratio.map((value, index) => ({
        x: index + 748,
        y: issuanceRateQ(index + 748, value)+0.21
      })),
      lineWidth: 3,
      dataLabels: {
        enabled: true,
        formatter: function() {
          if (this.point.index === this.series.data.length - 1 || this.point.x === currentCycle + 1) {
            return `${this.y.toFixed(2)}%`;
          }
          return null;
        },
        align: 'right',
        verticalAlign: 'bottom',
      },
      marker: { enabled: false },
    }],
    credits: { enabled: false }
  });
}

function createStakeChart(ratio, updateIssuanceChart) {
  return Highcharts.chart('stake', {
    chart: {
      type: 'spline',
      backgroundColor: 'rgba(0,0,0,0)',
      events: {
        load: function() { createVerticalLine(this, currentCycle + 1); }
      }
    },
    title: {
      text: 'Staked since Paris',
      style: { color: '#ffffff' }
    },
    xAxis: {
      labels: {
        formatter: function() {
          return this.value === currentCycle + 1 ? 'Now' : '';
        },
        style: { color: '#ffffff' }
      },
      lineColor: '#ffffff',
      title: { text: null },
      tickPositions: [currentCycle + 1],
      tickInterval: 1,
    },
    yAxis: {
      labels: { enabled: false },
      lineColor: '#ffffff',
      gridLineWidth: 0,
      title: { text: null },
      min: 0, max: 1,
      tickInterval: 0.2
    },
    tooltip: {
      formatter: function() {
        return `Cycle: ${this.x}<br><span style="color:${this.point.color}">●</span> ${this.series.name}: <b>${(this.y * 100).toFixed(2)}%</b><br/>`;
      }
    },
    series: [{
      zoneAxis: 'x',
      zones: [{ value: (currentCycle + 1) }, { dashStyle: 'ShortDot' }],
      shadow: {
        color: 'rgba(255, 255, 0, 0.7)',
        offsetX: 0, offsetY: 0,
        opacity: 1, width: 10
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
          if (this.point.index === this.series.data.length - 1 || this.point.x === currentCycle + 1) {
            return `${(this.y * 100).toFixed(2)}%`;
          }
          return null;
        },
        align: 'right',
        verticalAlign: 'bottom',
      },
      lineWidth: 3,
      marker: { enabled: false },
    }],
    credits: { enabled: false },
    plotOptions: {
      series: {
        color: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, '#77dd77'], [1, '#ff6961']]
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
              if (point.x <= currentCycle + 1) {
                e.newPoint.y = point.y;
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
}

function createPieChart(totalStakedPercentage, totalDelegatedPercentage, stakedAPY, delegatedAPY) {
  const jeetsPercentage = Math.max(0, 100 - totalStakedPercentage - totalDelegatedPercentage);

  Highcharts.chart('chart-container4', {
    chart: {
      backgroundColor: 'rgba(0,0,0,0)',
      type: 'pie'
    },
    title: {
      text: 'TezJeetMeter',
      style: { color: '#ffffff', fontSize: '24px' }
    },
    tooltip: {
      pointFormat: '<b>{point.name}: {point.y}%</b>'
    },
    series: [{
      name: 'Ratios',
      data: [
        { name: 'Staked ('+stakedAPY+'% APY)', y: totalStakedPercentage, color: Highcharts.getOptions().colors[1] },
        { name: 'Delegated ('+delegatedAPY+'% APY)', y: totalDelegatedPercentage, color: Highcharts.getOptions().colors[2] },
        { name: 'Jeets', y: jeetsPercentage, color: '#FF5733' }
      ],
      showInLegend: false,
      dataLabels: {
        enabled: true,
        format: '{point.name}',
        style: { color: '#ffffff', fontSize: '14px' }
      },
      borderColor: 'transparent'
    }],
    exporting: { enabled: false },
    credits: { enabled: false }
  });
}

function createBullMeter() {
  Highcharts.chart('chart-container5', {
    chart: {
      type: 'gauge',
      plotBackgroundColor: null,
      plotBackgroundImage: null,
      plotBorderWidth: 0,
      plotShadow: true,
      backgroundColor: 'rgba(0,0,0,0)',
    },
    title: {
      text: 'TezBullMeter',
      style: { color: '#ffffff' }
    },
    subtitle: {
      text: '',
      style: { fontSize: '0.75em', color: '#ffffff' }
    },
    pane: {
      startAngle: -90,
      endAngle: 89.9,
      background: null,
      center: ['50%', '75%'],
    },
    yAxis: {
      min: 0, max: 100,
      tickPixelInterval: 72,
      tickPosition: 'inside',
      tickColor: '#ffffff',
      tickLength: 20,
      tickWidth: 2,
      minorTickInterval: null,
      labels: {
        distance: 20,
        style: { fontSize: '14px', color: '#ffffff' }
      },
      lineWidth: 0,
      plotBands: [
        { from: 0, to: 40, color: '#DF5353', thickness: 20, borderRadius: '50%' },
        { from: 65, to: 100, color: '#55BF3B', thickness: 20, borderRadius: '50%' },
        { from: 30, to: 70, color: '#DDDF0D', thickness: 20 }
      ]
    },
    series: [{
      name: '',
      data: [calculateIndicator(forecasted)],
      tooltip: { valueSuffix: '% Moon' },
      dataLabels: {
        format: '{y}% Moon',
        borderWidth: 0,
        color: '#ffffff',
        style: { fontSize: '16px' }
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
    credits: { enabled: false }
  });
}

function createBurnedSupplyChart() {
  fetch('https://stats.dipdup.net/v1/histogram/balance_update/sum/month?field=Update&Kind=2&size=1000')
    .then(response => response.json())
    .then(data => {
      let seriesData = [];
      let cumulativeSum = 0;

      data.reverse().forEach(item => {
        const value = Math.abs(parseInt(item.value) / 1000000);
        cumulativeSum += value;
        cumulativeSum = parseFloat(cumulativeSum.toFixed(6));
        seriesData.push([new Date(item.ts * 1000).getTime(), cumulativeSum]);
      });

      seriesData.reverse();

      createTimeSeriesChart('chart-container', 'Burned Supply', seriesData, value => `${(value / 1000000).toFixed(2)}M`);
    })
    .catch(error => console.error('Error fetching data:', error));
}

function createTotalAccountsChart() {
  fetch('https://stats.dipdup.net/v1/histogram/accounts_stats/max/week?field=Total&size=1000')
    .then(response => response.json())
    .then(data => {
      const seriesData = data
        .reverse()
        .map(item => [new Date(item.ts * 1000).getTime(), Math.abs(parseInt(item.value))]);

      seriesData.reverse();

      createTimeSeriesChart('chart-container2', 'Total Accounts', seriesData, value => `${(value / 1000000).toFixed(2)}M`);
    })
    .catch(error => console.error('Error fetching data:', error));
}

function createTimeSeriesChart(containerId, title, data, formatter) {
  Highcharts.chart(containerId, {
    chart: {
      type: 'spline',
      backgroundColor: 'rgba(0,0,0,0)'
    },
    title: {
      text: title,
      style: { color: '#ffffff' }
    },
    xAxis: {
      type: 'datetime',
      lineColor: '#ffffff',
      lineWidth: 1,
      labels: { enabled: false }
    },
    yAxis: {
      gridLineWidth: 0,
      title: { text: null },
      labels: { enabled: false }
    },
    plotOptions: {
      series: {
        marker: { enabled: false },
        lineWidth: 2,
        states: { hover: { lineWidthPlus: 0 } },
        color: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, '#77dd77'], [1, '#ff6961']]
        }
      }
    },
    exporting: { enabled: false },
    series: [{
      showInLegend: false,
      shadow: {
        color: 'rgba(255, 255, 0, 0.7)',
        offsetX: 0, offsetY: 0,
        opacity: 1, width: 10
      },
      name: title,
      data: data,
      dataLabels: {
        enabled: true,
        formatter: function() {
          return this.point.index === 0 ? formatter(this.y) : null;
        },
        align: 'right',
        verticalAlign: 'bottom',
      },
    }],
    credits: { enabled: false }
  });
}

function createHistoricalCharts() {
  fetchHistoricalCycleData().then(data => {
    const issuanceData = processIssuanceData(data);
    const stakingData = processStakingData(data);
    currentCycle = issuanceData.currentCycle;
    
    createHistoricalChart('issuanceh', 'Issuance since genesis', issuanceData.ratios, d => ({
      x: d.cycle,
      y: d.issuance
    }), [428, 743, 823]);
    
    createHistoricalChart('stakingh', 'Staked since genesis', stakingData.ratios, d => ({
      x: d.cycle,
      y: d.staking * 100
    }), [428, 743, 823]);
  });
}

function createHistoricalChart(containerId, title, data, dataMapper, tickPositions) {
  Highcharts.chart(containerId, {
    chart: {
      type: 'spline',
      backgroundColor: 'rgba(0,0,0,0)',
      events: {
        load: function() { createVerticalLines(this, tickPositions); }
      }
    },
    title: {
      text: title,
      style: { color: '#ffffff' }
    },
    xAxis: {
      lineColor: '#ffffff',
      labels: {
        formatter: function() {
          if (this.value === 428) return 'Hangzhou';
          if (this.value === 743) return 'P';
          if (this.value === 823) return 'Q';
          return '';
        },
        style: { color: '#ffffff' }
      },
      title: { text: null },
      tickInterval: 1,
      tickPositions: tickPositions
    },
    yAxis: {
      labels: { enabled: false },
      gridLineWidth: 0,
      title: { text: null },
      min: 0,
      max: containerId === 'issuanceh' ? 11 : undefined,
      tickInterval: 1
    },
    tooltip: {
      formatter: function() {
        const label = containerId === 'issuanceh' ? 'Issuance' : 'Staking (frozen tez)';
        return `Cycle: ${this.x}<br><span style="color:${this.point.color}">●</span> ${label}: <b>${this.y.toFixed(2)}%</b><br/>`;
      }
    },
    series: [{
      zoneAxis: 'x',
      showInLegend: false,
      shadow: {
        color: 'rgba(255, 255, 0, 0.7)',
        offsetX: 0, offsetY: 0,
        opacity: 1, width: 10
      },
      color: {
        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
        stops: containerId === 'issuanceh' ? 
          [[0, '#ff6961'], [1, '#77dd77']] : 
          [[0, '#77dd77'], [1, '#ff6961']]
      },
      name: title,
      data: data.map(dataMapper),
      lineWidth: 3,
      dataLabels: {
        enabled: true,
        formatter: function() {
          if (this.point.index === this.series.data.length - 1 || this.point.x === currentCycle + 1) {
            return `${this.y.toFixed(2)}%`;
          }
          return null;
        },
        align: 'right',
        verticalAlign: 'bottom',
      },
      marker: { enabled: false },
    }],
    credits: { enabled: false }
  });
}

function updateIssuanceChart(newStakingData) {
  const issuanceDataQ = newStakingData.map(point => ({
    x: point.x,
    y: issuanceRateQ(point.x, point.y)+0.21
  }));

  Highcharts.charts.forEach(chart => {
    if (chart && chart.renderTo && chart.renderTo.id === 'issuance')
      chart.series[0].setData(issuanceDataQ, true);
  });
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
    const annualized = (growthRate * ((365.25 * 24 * 60 * 60) / timeDiffSec)) * 100;

    ratios.push({ cycle: curr.cycle, issuance: annualized });
  }

  return { ratios, currentCycle: data[data.length - 1].cycle };
}

function processStakingData(data) {
  return {
    ratios: data.slice(1).map(curr => ({
      cycle: curr.cycle,
      staking: curr.totalFrozen / curr.totalSupply
    })),
    currentCycle: data[data.length - 1].cycle
  };
}

// Main functions
function main(ratio) {
  const issuanceChart = createIssuanceChart(ratio);
  const stakeChart = createStakeChart(ratio, updateIssuanceChart);
  createBullMeter();
  createBurnedSupplyChart();
  createTotalAccountsChart();
  
  fetch('https://back.tzkt.io/v1/home?quote=usd')
    .then(response => response.json())
    .then(data => {
      const { totalStakedPercentage, totalDelegatedPercentage, stakingApy, delegationApy } = data.stakingData;
      createPieChart(
        totalStakedPercentage, 
        totalDelegatedPercentage, 
        stakingApy.toFixed(2), 
        delegationApy.toFixed(2)
      );
    })
    .catch(error => console.error('Error fetching the API data:', error));
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  if (location.hash != "") {
    const ratio = atob(location.hash.substring(1)).split(",");
    main(ratio);
  } else {
    initializeRatios()
      .then(ratios => main(ratios))
      .catch(error => console.error('Error initializing ratios:', error));
  }
  
  createHistoricalCharts();
});
