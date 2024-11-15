const socket = io()
socket.on('connection', async (err, data) => {
    console.log('connection is made...', err, data)
})

new Vue({
    el: '#app',
    data: {
        fileContent: '',
        history: [],
        yValue: [],
        xIncrement: [],
        xBase: [],
        layout: {},
        nodeCount: 0,
        eventColors: []
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
                text: this.history.map(event => event.name),
                textposition: 'auto',
                hoverinfo: 'none',
                marker: {
                    color: this.eventColors,
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
    async mounted() {
        const urlParams = new URLSearchParams(window.location.search)
        let maxHistory = urlParams.get('max_history')
        if (maxHistory) maxHistory = parseInt(maxHistory)
        else maxHistory = 1440 // last 24 hours
        socket.on('connect', async (e, data) => {
            console.log(`Connected as ${socket.id}`, e, data)
        })
        socket.on('old-data', async (data) => {
            this.fileContent += `${data}\n`
            socket.emit('message', 'let get started')
            let oldEventLines = data.split('\n')
            // for (let i = 0; i < oldEventLines.length; i++) {
            //     let line = oldEventLines[i]
            //     let splitted = line.split(" ")
            //     if (splitted[4] === 'started') {
            //         startLineNumber = i
            //     }
            // }
            let startLineNumber = oldEventLines.length - maxHistory
            oldEventLines = oldEventLines.slice(startLineNumber + 1)
            oldEventLines = oldEventLines.filter(line => line.split(" ").length === 9)

            let latestCycle = oldEventLines[oldEventLines.length - 1].split(" ")[8]

            let allHistory = []

            for (let eachEvent of oldEventLines) {
                let splittedData = eachEvent.split(' ')
                if (splittedData.length < 2) continue
                let name = splittedData[4]
                let nodeId = splittedData[5]
                let ip = splittedData[6]
                let port = splittedData[7]
                let cycle = parseInt(splittedData[8])
                if (this.validateIPV4(ip) === false) continue
                let event = {
                    name,
                    nodeId,
                    ip,
                    port,
                    cycle
                }
                allHistory.push(event)
            }
            if (latestCycle > maxHistory) {
                allHistory = allHistory.filter(event => event.cycle > latestCycle - maxHistory)
            }
            this.history = [...allHistory]
            this.history = this.history.sort((a, b) => a.cycle - b.cycle)
            this.updateChart()
        })
        socket.on('new-history-log', async (data) => {
            // this.fileContent += `${data}\n`
            let splittedData = data.split(' ')
            console.log('splitted data', splittedData)
            let name = splittedData[4]
            let nodeId = splittedData[5]
            let ip = splittedData[6]
            let port = splittedData[7]
            let cycle = parseInt(splittedData[8])
            let event = {
                name,
                nodeId,
                ip,
                port,
                cycle
            }
            if (this.validateIPV4(ip) === false) return
            this.history.push(event)
            this.updateChart()
        })

        console.log('Node history timeline')
        let data = [this.trace]
        this.layout = {
            title: 'Nodes History',
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
            yaxis: {
                automargin: true
            }
        };

        Plotly.newPlot('myDiv', data, this.layout, { scrollZoom: true });
        this.updateChart()
        // setInterval(this.updateChart, 5000)
    },
    methods: {
        getChart() {
            return this.chart
        },
        // a function to check if the input string is a valid IPV4 ip address
        validateIPV4(ip) {
            let ipArr = ip.split('.')
            if (ipArr.length !== 4) return false
            for (let i = 0; i < ipArr.length; i++) {
                let num = parseInt(ipArr[i])
                if (Number.isNaN(num) || num < 0 || num > 255) return false
            }
            return true
        },
        async updateChart() {
            console.log('updating chart')
            const shouldUpdateChart = await this.getReport()
            if (shouldUpdateChart) {
                let data = [{ ...this.trace }]
                Plotly.newPlot('myDiv', data, this.layout)
            }
        },
        async getReport() {
            console.log(this.history.map(event => event.ip + "__" + event.port))
            this.yValue = this.history.map(event => {
                return `${event.ip}:${event.port}`
            })
            this.xBase = this.history.map(event => {
                return event.cycle
            })
            this.xIncrement = this.history.map(event => {
                return event.cycle + 1 - event.cycle
            })
            this.eventColors = this.history.map(event => {
                if (event.name === 'active') return '#00ff00'
                else if (event.name === 'joined') return '#ffd480'
                else if (event.name === 'removed') return '#00ffff'
                else if (event.name === 'dead') return '#ff0000'
            })
            return true
        }
    }
})
