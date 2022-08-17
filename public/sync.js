
function initSyncChart() {
    new Vue({
        el: '#app',
        data: {
            yValue: [],
            xIncrement: [],
            xBase: [],
            layout: {},
            nodeCount: 0
        },
        computed: {
            trace() {
                return {
                    x: this.xIncrement,
                    y: this.yValue,
                    base: this.xBase,
                    type: 'bar',
                    // width: 0.5,
                    name: 'Sync Duration',
                    text: this.xIncrement.map(String),
                    textposition: 'auto',
                    hoverinfo: 'none',
                    marker: {
                        color: 'rgb(158,202,225)',
                        opacity: 0.6,
                        line: {
                            color: 'rgb(8,48,107)',
                            width: 1.5
                        }
                    },
                    orientation: 'h'
                }
            }
        },
        mounted: function () {
            console.log('Sync page loaded!')
            let data = [this.trace]
            this.layout = {
                title: 'Node Sync Timeline',
                barmode: 'stack',
                xaxis: {
                    autotick: false,
                    ticks: 'outside',
                    tick0: 0,
                    dtick: 1,
                    ticklen: 8,
                    tickwidth: 4,
                    tickcolor: '#000',
                },
            };

            Plotly.newPlot('myDiv', data, this.layout, { scrollZoom: true });
            this.updateChart()
            setInterval(this.updateChart, 5000)
        },
        methods: {
            getChart() {
                return this.chart
            },
            async updateChart() {
                const shouldUpdateChart = await this.getReport()
                if (shouldUpdateChart) {
                    let data = [{ ...this.trace }]
                    Plotly.newPlot('myDiv', data, this.layout)
                }
            },
            async getReport() {
                const response = await requestWithToken(`${monitorServerUrl}/sync-report`)
                const heartbeatResponse = await requestWithToken(`${monitorServerUrl}/report`)
                const report = response.data
                if (Object.keys(report).length === 0) return
                if (Object.keys(report).length <= this.nodeCount) return false
                else this.nodeCount = Object.keys(report).length

                let newLables = Object.keys(report)
                this.yValue = newLables.map(nodeId => {
                    let node = heartbeatResponse.data.nodes.syncing[nodeId] || heartbeatResponse.data.nodes.active[nodeId]
                    if (node) return `${node.nodeIpInfo.externalIp}:${node.nodeIpInfo.externalPort}`
                    else return nodeId
                })
                this.xBase = Object.values(report).map(r => {
                    return r.cycleStarted
                })
                this.xIncrement = Object.values(report).map(r => {
                    return r.cycleEnded - r.cycleStarted
                })
                return true
            }
        }
    })
}
initSyncChart()
