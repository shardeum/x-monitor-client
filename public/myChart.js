new Vue({
    el: '#app',
    data: {
        labels: [],
        tps: [],
        txProcessed: [],
        txRejected: [],
        loads: [],
        internalLoad: [],
        activeCount: [],
        xValue: [],
        data: [],
        chart: null,
        currentCounter: null,
        currentTotalProcessed: 0,
        currentTotalRejected: 0,
        lastxValue: null,
        lastCycleStart: null,
        currentNodeCount: 0,
        limit: 100,
        cycleDuration: null,
        updateInterval: 2000,
        collector: {
            tps: [],
            loads: [],
            internalLoad: [],
            activeCount: [],
            txProcessed: [],
            txRejected: [],
            count: 0
        }
    },
    computed: {
        traces() {
            return [
                {
                    x: this.xValue,
                    y: this.tps,
                    type: 'scatter',
                    line: { shape: 'linear' },
                    name: 'Avg TPS',
                    text: this.tps.map(item => item.toFixed(0)),
                    textposition: 'top',
                    mode: 'lines+markers+text',
                    hoverinfo: 'none',
                    marker: {
                        color: 'rgb(158,202,225)',
                        opacity: 0.6,
                        line: {
                            color: 'rgb(8,48,107)',
                            width: 1.5
                        }
                    }
                },
                {
                    x: this.xValue,
                    y: this.activeCount,
                    type: 'scatter',
                    line: { shape: 'linear' },
                    name: 'Active Nodes',
                    text: this.activeCount.map(item => item.toFixed(0)),
                    textposition: 'top',
                    mode: 'lines+markers+text',
                    hoverinfo: 'none',
                    marker: {
                        color: '#c1c1c1',
                        opacity: 0.6,
                        line: {
                            color: '#c1c1c1',
                            width: 1.5
                        }
                    }
                },
                {
                    x: this.xValue,
                    y: this.txRejected,
                    type: 'scatter',
                    line: { shape: 'linear' },
                    name: 'Rejected TPS',
                    text: this.txRejected.map(item => item.toFixed(0)),
                    textposition: 'top',
                    mode: 'lines+markers+text',
                    hoverinfo: 'none',
                    marker: {
                        color: '#fc9803',
                        opacity: 0.6,
                        line: {
                            color: '#fc9803',
                            width: 1.5
                        }
                    }
                },
                {
                    x: this.xValue,
                    y: this.loads,
                    type: 'scatter',
                    yaxis: 'y2',
                    line: { shape: 'linear' },
                    name: 'Load',
                    text: this.loads.map(item => item.toFixed(2)),
                    textposition: 'top',
                    mode: 'lines+markers+text',
                    hoverinfo: 'none',
                    marker: {
                        color: 'rgb(255,48,48)',
                        opacity: 0.6,
                        line: {
                            color: 'rgb(255,48,48)',
                            width: 1.5
                        }
                    }

                },
                {
                    x: this.xValue,
                    y: this.internalLoad,
                    type: 'scatter',
                    yaxis: 'y2',
                    line: { shape: 'linear' },
                    name: 'Internal Load',
                    text: this.internalLoad.map(item => item.toFixed(2)),
                    textposition: 'top',
                    mode: 'lines+markers+text',
                    hoverinfo: 'none',
                    marker: {
                        color: 'rgb(0,255,48)',
                        opacity: 0.6,
                        line: {
                            color: 'rgb(0, 255, 48)',
                            width: 1.5
                        }
                    }
                }
            ]
        },
    },
    mounted: function () {
        console.log('mounted')
        this.labels = []
        this.tps = []
        this.txProcessed = []
        this.txRejected = []
        let data = [this.traces]
        this.layout = {
            title: 'Network Performance Chart',
            barmode: 'stack',
            xaxis: {
                autorange: true,
                autotick: false,
                ticks: 'outside',
                tick0: 0,
                dtick: 0.5,
                ticklen: 8,
                tickwidth: 4,
                tickcolor: '#000',
                title: "Cycle Number"
            },
            yaxis: {
                rangemode: 'nonnegative',
                autorange: true,
                title: 'TPS (or) Node Count'
            },
            yaxis2: {
                title: 'Load Ratio',
                titlefont: { color: 'rgb(148, 103, 189)' },
                tickfont: { color: 'rgb(148, 103, 189)' },
                overlaying: 'y',
                side: 'right',
                range: [0, 1],
                showgrid: false
            }
        };

        Plotly.newPlot('myDiv', this.traces, this.layout, { scrollZoom: true });
        this.updateChart()
        setInterval(this.updateChart, this.updateInterval)
    },
    methods: {
        resetCollector() {
            this.collector.count = 0
            this.collector.tps = []
            this.collector.loads = []
            this.collector.internalLoad = []
            this.collector.txProcessed = []
            this.collector.txRejected = []
        },
        logCollector() {
            console.log("collector count", this.collector.count)
            console.log("collector tps", this.collector.tps.length)
            console.log("collector loads", this.collector.loads.length)
        },
        calcuateAvg(arr) {
            if (arr.length === 0) return 0
            const sum = arr.reduce((p, c) => p + c, 0)
            return sum / arr.length
        },
        async updateChart() {
            await this.getReport()
            if (this.tps.length > this.limit) this.tps.splice(0, 1)
            if (this.loads.length > this.limit) this.loads.splice(0, 1)
            if (this.internalLoad.length > this.limit) this.internalLoad.splice(0, 1)
            if (this.activeCount.length > this.limit) this.activeCount.splice(0, 1)
            if (this.txProcessed.length > this.limit) this.txProcessed.splice(0, 1)
            if (this.txRejected.length > this.limit) this.txRejected.splice(0, 1)
            if (this.xValue.length > this.limit) this.xValue.splice(0, 1)
            const shouldRedraw = this.collector.count >= 3
            if (shouldRedraw) {
                this.tps.push(this.calcuateAvg(this.collector.tps))
                this.loads.push(this.calcuateAvg(this.collector.loads))
                this.internalLoad.push(this.calcuateAvg(this.collector.internalLoad))
                this.activeCount.push(this.currentNodeCount)
                this.txRejected.push(this.calcuateAvg(this.collector.txRejected))
                this.xValue.push(this.lastxValue)
                Plotly.newPlot('myDiv', this.traces, this.layout)
                //Plotly.redraw('myDiv', this.traces)
                this.resetCollector()
            }
        },
        async getCycleDuration(activeNode) {
            let ip = activeNode.nodeIpInfo.externalIp
            if (ip === 'localhost' || ip === '127.0.0.1') {
                ip = window.location.href.split('//')[1].split(":")[0]
            }
            console.log('ip', ip)
           const response = await requestWithToken(`http://${ip}:${activeNode.nodeIpInfo.externalPort}/sync-newest-cycle`)
            const cycleRecord = response.data.newestCycle
            if (cycleRecord && cycleRecord.duration) this.cycleDuration = cycleRecord.duration
        },
        async getReport() {
            const response = await requestWithToken(`/api/report`)
            try {
                if (Object.keys(response.data.nodes.active).length > 0) {
                    if (!this.cycleDuration) {
                        await this.getCycleDuration(Object.values(response.data.nodes.active)[0])
                    }
                    let numberOfActiveNodes = Object.keys(response.data.nodes.active).length
                    this.currentNodeCount = numberOfActiveNodes
                    let loads = []
                    let cycleCounter
                    // collect load
                    for (let nodeId in response.data.nodes.active) {
                        let activeNode = response.data.nodes.active[nodeId]
                        if (!cycleCounter) cycleCounter = activeNode.cycleCounter
                        loads.push(activeNode.currentLoad)
                    }

                    // collect cycleCounter
                    if (!this.currentCounter) {
                        this.currentCounter = cycleCounter
                        return
                    } else if (this.currentCounter && cycleCounter > this.currentCounter) {
                        this.lastCycleStart = response.data.timestamp
                        this.lastxValue = cycleCounter
                        this.currentCounter = cycleCounter
                    } else if (this.lastCycleStart && this.currentCounter === cycleCounter && response.data.timestamp > this.lastCycleStart) {
                        let cycleIncrement = (response.data.timestamp - this.lastCycleStart) / (this.cycleDuration * 1000)
                        this.lastxValue = this.currentCounter + cycleIncrement
                    } else {
                        console.log("lastxValue cannot be calculated")
                        return
                    }

                    // collected txProcessed
                    if (response.data.totalProcessed > this.currentTotalProcessed) {
                        let increment = response.data.totalProcessed - this.currentTotalProcessed
                        if (this.currentTotalProcessed !== null) this.collector.txProcessed.push(increment)
                        this.currentTotalProcessed = response.data.totalProcessed
                    } else {
                        this.collector.txProcessed.push(0)
                    }

                    // collect txRejected
                    if (response.data.totalRejected > this.currentTotalRejected) {
                        console.log("response.data.totalRejected", response.data.totalRejected)
                        console.log("currentTotalRejected", this.currentTotalRejected)
                        let increment = response.data.totalRejected - this.currentTotalRejected
                        console.log("increment", increment)
                        //if (this.currentTotalRejected !== null) this.collector.txRejected.push(increment)
                        if (this.currentTotalRejected > 0) this.collector.txRejected.push(increment / 2) // divided by 2s so that results is rejectedTps
                        this.currentTotalRejected = response.data.totalRejected
                    } else {
                        this.collector.txRejected.push(0)
                    }

                    this.collector.tps.push(response.data.avgTps)
                    let averageLoad = {
                        networkLoad: loads.map(l => l.networkLoad).reduce((p, c) => p + c, 0) / loads.length,
                        internal: loads.map(l => l.nodeLoad.internal).reduce((p, c) => p + c, 0) / loads.length,
                        external: loads.map(l => l.nodeLoad.external).reduce((p, c) => p + c, 0) / loads.length,
                    }
                    this.collector.loads.push(averageLoad.networkLoad)
                    this.collector.internalLoad.push(averageLoad.internal)
                    this.collector.count += 1
                }
            } catch (e) {
                console.log("Error while processing the report", e)
            }
        },
    }
})
