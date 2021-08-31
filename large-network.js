(function main () {
    const url = new URL(window.location.href)
    // const monitorServerUrl = 'http://localhost:3000/api'
    const monitorServerUrl = window.origin + '/api'
    console.log('Monitor server', monitorServerUrl)
    const G = {}
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    G.VH = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight || 0
    )

    G.R = 100
    G.X = 0
    G.Y = 0
    G.nodeRadius = 200
    G.maxId = parseInt('ffff', 16)
    G.lastUpdatedTimestamp = 0
    G.nodes = {
        joining: {},
        syncing: {},
        active: {}
    }
    let n = 0
    let tracker = {}
    let maxN = 0
    let C = 150

    new Vue({
        el: '#app',
        data() {
            return {
                networkStatus: {
                    active: 0,
                    syncing: 0,
                    joining: 0,
                    counter: 0,
                    desired: 0,
                    tps: 0,
                    processed: 0,
                    rejected: 0,
                    netLoad: 0
                }
            }
        },
        async mounted() {
            this.start()
        },
        methods: {
            calculateNetworkPosition(nodeId) {
                let spread = 4
                let angle = 137.508
                let phi = angle * Math.PI / 180
                let idRatio = parseInt((nodeId / G.maxId))
                if (tracker[idRatio]) {
                    idRatio = maxN + 1
                }
                tracker[idRatio] = true
                if (idRatio > maxN) maxN = idRatio
                n = idRatio
                let r = spread * Math.sqrt(n) + C
                const theta = n * phi
                const x = r * Math.cos(theta) + G.X
                const y = r * Math.sin(theta) + G.Y
                n += 1
                return {
                    x,
                    y,
                    degree: angle * n
                }
            },
            randomIntFromInterval(min, max) { // min and max included
                return Math.floor(Math.random() * (max - min + 1) + min)
            },
            calculateNetworkPositionNew(nodeId, totalNodeCount) {
                let idRatio = nodeId / G.maxId
                let angle = idRatio * 360
                let nearestAngle = parseInt(angle)
                const theta = nearestAngle * Math.PI / 180
                const r = G.R + radiusTracker[nearestAngle] + randomIntFromInterval(-7, 7)
                const x = r * Math.cos(theta) + G.X
                const y = r * Math.sin(theta) + G.Y
                radiusTracker[nearestAngle] += 20
                return {
                    x,
                    y,
                    degree: angle
                }
            },
            generateRandomColor() {
                let n = (Math.random() * 0xfffff * 1000000).toString(16)
                return '#' + n.slice(0, 6)
            },
            htmlTitle(html) {
                const container = document.createElement('div')
                container.innerHTML = html
                return container
            },
            getNewVisNode(nodeId, node) {
                let position = this.calculateNetworkPosition(parseInt(nodeId.substr(0, 4), 16))
                return {
                    id: nodeId,
                    x: position.x,
                    y: position.y,
                    physics: false,
                    title: this.getTitle(nodeId, node),
                    color: `#${node.cycleMarker.substr(0, 6)}`
                }
            },
            getUpdatedVisNode(nodeId, node) {
                return {
                    id: nodeId,
                    title: this.getTitle(nodeId, node),
                    color: `#${node.cycleMarker.substr(0, 6)}`
                }
            },
            async  fetchChanges(timestamp) {
                let res = await axios.get(`${monitorServerUrl}/report?timestamp=${G.lastUpdatedTimestamp}`)
                return res.data
            },
            addNewNodesIntoNetwork(newNodes) {
                let newVisNodes = []
                for (let node of newNodes) {
                    const visNode = this.getNewVisNode(node.nodeId, node)
                    newVisNodes.push(visNode)
                }
                G.data.add(newVisNodes)
            },
            updateNetworkStatus(report) {
                this.networkStatus.tps = report.avgTps
                this.networkStatus.processed = report.totalProcessed
                this.networkStatus.rejected = report.totalRejected
                this.networkStatus.active = Object.keys(report.nodes.active).length
                this.networkStatus.syncing = Object.keys(report.nodes.syncing).length
                this.networkStatus.joining = Object.keys(report.nodes.joining).length

                let loads = []
                let counters = []
                let cycleMarkers = []
                let desired = []

                for (let nodeId in report.nodes.active) {
                    const node = report.nodes.active[nodeId]
                    loads.push(node.currentLoad.networkLoad)
                    counters.push(node.cycleCounter)
                    cycleMarkers.push(node.cycleMarker)
                    desired.push(node.desiredNodes)
                }
                this.networkStatus.load = this.average(loads)
                this.networkStatus.counter = this.mode(counters)
                this.networkStatus.cycleMarker = this.mode(cycleMarkers)
                this.networkStatus.desired = this.mode(desired)

            },
            async deleteRemovedNodes() {
                try {
                    let res = await axios.get(`${monitorServerUrl}/removed`)
                    const removed = res.data.removed
                    if (removed.length === 0) {
                        console.log("No node removed in counter", this.networkStatus.counter)
                        return
                    }
                    let removedNodeIds = []
                    for (let node of removed) {
                        const nodeId = node.nodeId
                        const activeNode = G.nodes.active[nodeId]
                        if (!activeNode) continue
                        removedNodeIds.push({id: nodeId})
                        delete G.nodes.active[nodeId]
                    }
                    if (removedNodeIds.length === 0) return
                    console.log("removed ids", removedNodeIds)
                    G.data.remove(removedNodeIds)
                } catch (e) {
                    console.log("Error while trying to remove nodes", e)
                }
            },
            async  updateNodes() {
                try {
                    let changes = await this.fetchChanges()
                    this.updateNetworkStatus(changes)
                    let updatedNodes = []
                    let newNodes = []
                    for (let nodeId in changes.nodes.active) {
                        let node = changes.nodes.active[nodeId]
                        if (!G.nodes.active[nodeId]) {
                            console.log('New node joined the network')
                            G.nodes.active[nodeId] = node
                            newNodes.push(node)
                            continue
                        }
                        let updatedVisNode = this.getUpdatedVisNode(nodeId, node)
                        updatedNodes.push(updatedVisNode)
                    }
                    this.addNewNodesIntoNetwork(newNodes)
                    G.data.update(updatedNodes)
                    await this.deleteRemovedNodes()
                    G.lastUpdatedTimestamp = Date.now()
                    if (this.shouldChangeNodesSize()) this.changeNodesSize()
                } catch(e) {
                    console.log("Error while trying to update nodes.", e)
                }
            },
            getNodeSize(count) {
                if (count >= 5000) return 2
                if (count >= 1000) return 3
                if (count >= 100) return 5
                return 7
            },
            shouldChangeNodesSize() {
                const newNodeSize = this.getNodeSize(Object.keys(G.nodes.active).length)
                if (newNodeSize !== G.currentNodeSize) return true
                return false
            },

            getTitle(nodeId, node) {
                return this.htmlTitle(`
            <p><strong>NodeId</strong>: ${nodeId}</p>
            <p><strong>IP Address</strong>: ${node.nodeIpInfo.externalIp}:${node.nodeIpInfo.externalPort}</p>
            <p><strong>NodeList Hash</strong>: ${node.nodelistHash}</p>
            <p><strong>CycleMaker Hash</strong>: ${node.cycleMarker}</p>
            `)
            },

            changeNodesSize() {
                const nodeSize = this.getNodeSize(Object.keys(G.nodes.active).length)
                const options = {
                    nodes: {
                        // size: 2,
                        size: nodeSize
                    }
                }
                G.network.setOptions(options)
                G.network.redraw()
                G.currentNodeSize = nodeSize
            },
            average(list) {
                if (list.length === 0) return 0
                const total = list.reduce((p, c) => p + c, 0)
                return total / list.length
            },
            mode(list) {
                const arr = [...list]
                return arr
                    .sort(
                        (a, b) =>
                            arr.filter(v => v === a).length - arr.filter(v => v === b).length
                    )
                    .pop()
            },
            async  start() {
                let res = await axios.get(`${monitorServerUrl}/report`)
                let newNodes = []
                for (let nodeId in res.data.nodes.active) {
                    let node = res.data.nodes.active[nodeId]
                    let visNode = this.getNewVisNode(nodeId, node)
                    newNodes.push(visNode)
                    G.nodes.active[nodeId] = node
                }
                G.data = new vis.DataSet(newNodes)
                this.updateNetworkStatus(res.data)

                // create a network
                const container = document.getElementById('mynetwork')

                // provide the data in the vis format
                let data = {
                    nodes: G.data
                }
                const options = {
                    nodes: {
                        shape: 'dot',
                        size: this.getNodeSize(Object.keys(G.nodes.active).length),
                        font: {
                            size: 12,
                            face: 'Arial'
                        }
                    }
                }

                // initialize your network!
                G.network = new vis.Network(container, data, options)
                G.currentNodeSize = this.getNodeSize(Object.keys(G.nodes.active).length)
                G.network.on('click',  (params) => {
                    console.log("params", params)
                    const nodeId = params.nodes[0]
                    const node = G.nodes.active[nodeId]
                    if (!node) return
                    window.open(`/log?ip=${node.externalIp}&port=${node.externalPort}`)
                })
                setInterval(this.updateNodes, 5000)

            },
        }
    })
})()
