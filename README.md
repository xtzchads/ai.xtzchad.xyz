# Chad Charts

This project visualizes various metrics related to the Tezos blockchain, including issuance rates, staking ratios, burned supply, and total accounts over time. It uses Highcharts.js to create interactive and visually appealing charts.

## Features

- **Issuance Rate Chart**: Simulates the issuance rate of Tezos over different cycles.
- **Staking Ratio Chart**: Shows the staking ratio with draggable points to customize and see the effect on the issuance rate.
- **Burned Supply Chart**: Cumulative sum of the burned supply over time.
- **Total Accounts Chart**: Total number of accounts over time.
- **TezBullMeter**: Based on distance from forecasted staking ratio over 100 cycles to 50% staking equilibrium using sigmoid function.

## Dependencies

- [Highcharts](https://www.highcharts.com/)
- [Bootstrap 5](https://getbootstrap.com/)
- TZKT API
- tzStats API

## License

This project is licensed under the MIT License.
