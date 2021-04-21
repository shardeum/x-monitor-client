
function initSyncChart() {
    new Vue({
        el: '#app',
        data: {
            labels: [],
            data: [],
            chart: null,
            nodeCount: 0,
            currentTotalProcessed: null
        },
        computed: {
            config() {
                return {
                    type: 'bar',
                    data: this.data,
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        scales: {
                            x: {
                                stacked: true,
                                ticks: {
                                    // forces step size to be 50 units
                                    stepSize: 1
                                }
                            },
                            y: {
                                stacked: true,
                                ticks: {
                                    // forces step size to be 50 units
                                    stepSize: 1
                                }
                            },


                        },
                        legend: {
                            position: 'right',
                        },
                        title: {
                            display: true,
                            text: 'Horizontal Floating Bars'
                        },
                        tooltips: false,
                        hover: {
                            animationDuration: 0
                        },
                        events: false,
                        animation: {
                            duration: 1,
                            onComplete: () => {
                                console.log("running on complete", this.getChart())
                                var chartInstance = this.getChart(),
                                    ctx = chartInstance.ctx;
                                ctx.font = Chart.helpers.fontString(Chart.defaults.defaultFontSize, Chart.defaults.defaultFontStyle, Chart.defaults.defaultFontFamily);
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                console.log("chartInstance", chartInstance)
                                this.data.datasets.forEach(function (dataset, i) {
                                    var meta = chartInstance.getDatasetMeta(i);
                                    console.log("meta", meta)
                                    meta.data.forEach(function (bar, index) {
                                        var data = dataset.data[index];
                                        ctx.fillText(data[1] - data[0], bar.x + 10, bar.y - 5);
                                    });
                                });
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
                labels: [],
                datasets: [
                    {
                        label: 'Sync Statement',
                        data: [],
                        barThickness: 6,
                        maxBarThickness: 8,
                        backgroundColor: 'blue',
                        datalabels: {
                            color: '#FFCE56'
                        }
                    }
                ]
            }
            this.chart = new Chart(
                document.getElementById('myChart'),
                this.config
            );
            this.updateChart()
            setInterval(this.updateChart, 5000)
        },
        methods: {
            getChart() {
                return this.chart
            },
            async updateChart() {
                const shouldUpdateChart = await this.getReport()
                console.log(this.nodeCount)
                console.log(shouldUpdateChart)
                if (shouldUpdateChart) this.chart.update()
            },
            async getReport() {
                const response = await axios.get(`http://localhost:3000/api/sync-report`)
                const heartbeatResponse = await axios.get(`http://localhost:3000/api/report`)
                const report = response.data
                if (Object.keys(report).length === 0) return
                if (Object.keys(report).length <= this.nodeCount) return false
                else this.nodeCount = Object.keys(report).length

                let newLables = Object.keys(report)
                newLables = newLables.map(nodeId => {
                    let node = heartbeatResponse.data.nodes.syncing[nodeId] || heartbeatResponse.data.nodes.active[nodeId]
                    if (node) return `${node.nodeIpInfo.externalIp}:${node.nodeIpInfo.externalPort}`
                    else return nodeId
                })
                let newDatasets = []
                let label = "data 1"
                let data = Object.values(report).map(r => {
                    return [r.cycleStarted, r.cycleEnded]
                })
                newDatasets.push({
                    label, data, backgroundColor: 'blue', barThickness: 6,
                    maxBarThickness: 8,
                })
                this.chart.data.labels = newLables
                this.chart.data.datasets = newDatasets
                return true
            }
        }
    })
}
initSyncChart()
