

new Vue({
    el: '#app',
    data: {
        labels: [],
        tps: [],
        txProcessed: [],
        loads: [],
        data: [],
        chart: null,
        currentCounter: 0,
        currentTotalProcessed: null
    },
    computed: {
        config() {
            return {
                type: 'line',
                data: this.data,
                options: {
                    scales: {
                        y: {
                            type: 'linear',
                            text: 'TPS',
                            display: true,
                            position: 'left',
                            min: 0
                        },
                        y1: {
                            type: 'linear',
                            text: 'Load',
                            display: true,
                            position: 'right',
                            min: 0,
                            max: 1,
                            // grid line settings
                            grid: {
                                drawOnChartArea: false, // only want the grid lines for one axis to show up
                            },
                        },
                        y2: {
                            type: 'logarithmic',
                            text: 'TXS',
                            display: false,
                            position: 'left',
                            min: 0
                        }
                    }
                }
            }
        },
        networkLoad() {
            return this.loads.map(l => l.networkLoad)
        },
        internalLoad() {
            return this.loads.map(l => l.internal)
        }
    },
    mounted: function () {
        console.log('mounted')
        this.labels = []
        this.tps = []
        this.txProcessed = []
        this.data = {
            labels: this.labels,
            datasets: [
                {
                    label: 'Avg Tps',
                    backgroundColor: '#D33257',
                    borderColor: '#D33257',
                    cubicInterpolationMode: 'monotone',
                    tension: 0.4,
                    data: this.tps,
                    yAxisID: 'y',
                },
                {
                    label: 'Load',
                    backgroundColor: '#1DABB8',
                    borderColor: '#1DABB8',
                    cubicInterpolationMode: 'monotone',
                    tension: 0.4,
                    data: this.networkLoad,
                    yAxisID: 'y1',
                },
                {
                    label: 'Internal',
                    backgroundColor: '#27AE60',
                    borderColor: '#27AE60',
                    cubicInterpolationMode: 'monotone',
                    tension: 0.4,
                    data: this.internalLoad,
                    yAxisID: 'y1',
                },
                {
                    type: 'bar',
                    label: 'TxProcessed',
                    backgroundColor: '#dddddd',
                    borderColor: 'rgb(201, 203, 207)',
                    data: this.txProcessed,
                    yAxisID: 'y2',
                    maxBarThickness: 50
                }
            ]
        };

        this.chart = new Chart(
            document.getElementById('myChart'),
            this.config
        );
        setInterval(this.updateChart, 4000)
    },
    methods: {
        async updateChart() {
            await this.getReport()
            if (this.labels.length > 30) this.labels.splice(0, 1)
            if (this.tps.length > 30) this.tps.splice(0, 1)
            if (this.loads.length > 30) this.loads.splice(0, 1)
            if (this.txProcessed.length > 30) this.txProcessed.splice(0, 1)
            this.data.datasets[1].data = this.networkLoad
            this.data.datasets[2].data = this.internalLoad
            this.chart.update()
        },
        async getReport() {
            const response = await axios.get(`/api/report`)
            if (Object.keys(response.data.nodes.active).length > 0) {
                let numberOfActiveNodes = Object.keys(response.data.nodes.active).length
                let loads = []
                let cycleCounter
                for (let nodeId in response.data.nodes.active) {
                    let activeNode = response.data.nodes.active[nodeId]
                    if (!cycleCounter) cycleCounter = activeNode.cycleCounter
                    loads.push(activeNode.currentLoad)
                }
                if (cycleCounter > this.currentCounter) {
                    this.currentCounter = cycleCounter
                    this.labels.push(this.currentCounter)
                } else {
                    this.labels.push(".")
                }
                if (response.data.totalProcessed > this.currentTotalProcessed) {
                    let increment = response.data.totalProcessed - this.currentTotalProcessed
                    if (this.currentTotalProcessed !== null) this.txProcessed.push(increment)
                    this.currentTotalProcessed = response.data.totalProcessed
                } else {
                    this.txProcessed.push(0)
                }
                this.tps.push(response.data.avgTps)
                let averageLoad = {
                    networkLoad: loads.map(l => l.networkLoad).reduce((p, c) => p + c, 0) / loads.length,
                    internal: loads.map(l => l.nodeLoad.internal).reduce((p, c) => p + c, 0) / loads.length,
                    external: loads.map(l => l.nodeLoad.external).reduce((p, c) => p + c, 0) / loads.length,
                }
                this.loads.push(averageLoad)
            }
        },
    }
})
