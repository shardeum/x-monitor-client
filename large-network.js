;(function main() {
    const url = new URL(window.location.href)
    // const monitorServerUrl = 'http://52.201.247.225:3000/api'
    const monitorServerUrl = window.origin + '/api'
    console.log('Monitor server', monitorServerUrl)
    const G = {}
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    G.VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
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
                    maxTps: 0,
                    processed: 0,
                    rejected: 0,
                    netLoad: 0,
                    load: 0,
                    maxLoad: 0
                },
                colorMode: 'state',
                shouldShowMaxTps: false,
                shouldShowMaxLoad: false
            }
        },
        async mounted() {
            console.log('Mounted')
            this.start()
        },
        methods: {
            calculateNetworkPosition(nodeId) {
                let spread = 4
                let angle = 137.508
                let phi = (angle * Math.PI) / 180
                let idRatio = parseInt(nodeId / G.maxId)
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
            randomIntFromInterval(min, max) {
                // min and max included
                return Math.floor(Math.random() * (max - min + 1) + min)
            },
            calculateNetworkPositionNew(nodeId, totalNodeCount) {
                let idRatio = nodeId / G.maxId
                let angle = idRatio * 360
                let nearestAngle = parseInt(angle)
                const theta = (nearestAngle * Math.PI) / 180
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
                    color: this.getNodeColor(node)
                }
            },
            getNewArchiverVisNodes(archivers) {
                let visNodes = archivers.map((archiver, index) => {
                    return {
                        id: archiver.publicKey,
                        x: 0,
                        y: 0 - 130 + (index * 20),
                        physics: false,
                        title: archiver.publicKey,
                        color: "#abc2ec"
                    }
                })
                return visNodes
            },
            getUpdatedVisNode(nodeId, node) {
                return {
                    id: nodeId,
                    title: this.getTitle(nodeId, node),
                    color: this.getNodeColor(node)
                }
            },
            getNodeColor(node) {
                if (!node.cycleMarker) return '#fcbf49' // syncing node
                let color = '#000000'
                if (this.colorMode === 'state') {
                    color = node.isDataSynced ? '#80ED99' : '#FF2EFF'
                    if (node.crashed && !node.isRefuted) color = '#FF2442'
                } else if (this.colorMode === 'marker') color = `#${node.cycleMarker.substr(0, 6)}`
                else if (this.colorMode === 'nodelist') color = `#${node.nodelistHash.substr(0, 6)}`
                return color
            },
            onColorModeChange(event) {
                if (event.target.value === this.colorMode) return
                this.colorMode = event.target.value
                this.changeNodeColor()
            },
            async fetchChanges(timestamp) {
                let res = await axios.get(
                    `${monitorServerUrl}/report?timestamp=${G.lastUpdatedTimestamp}`
                )
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
                if (Object.keys(report.nodes.active).length === 0) return // don't update stats if no nodes send the
                let reportPercentage = Object.keys(report.nodes.active).length / Object.keys(G.nodes.active).length
                console.log('reportPercentage', reportPercentage)
                if (reportPercentage < 0.3) return // don't update stats if less than 30% of network updates
                this.networkStatus.tps = report.avgTps
                this.networkStatus.maxTps = report.maxTps
                this.networkStatus.processed = report.totalProcessed
                this.networkStatus.rejected = report.totalRejected
                this.networkStatus.active = Object.keys(G.nodes.active).length
                this.networkStatus.syncing = Object.keys(G.nodes.syncing).length
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
                if (this.networkStatus.load > this.networkStatus.maxLoad) {
                    this.networkStatus.maxLoad = this.networkStatus.load
                }
            },
            deleteCrashedNodes(nodes) {
                try {
                    let removedNodeIds = []
                    for (let node of nodes) {
                        const nodeId = node.nodeId
                        const activeNode = G.nodes.active[nodeId]
                        if (!activeNode) continue
                        removedNodeIds.push({id: nodeId})
                        delete G.nodes.active[nodeId]
                    }
                    if (removedNodeIds.length === 0) return
                    console.log('removed crashed ids', removedNodeIds)
                    G.data.remove(removedNodeIds)
                } catch (e) {
                    console.log('Error while trying to remove crashed nodes', e)
                }
            },
            async deleteRemovedNodes() {
                try {
                    let res = await axios.get(`${monitorServerUrl}/removed`)
                    const removed = res.data.removed
                    if (removed.length === 0) {
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
                    console.log('removed ids', removedNodeIds)
                    G.data.remove(removedNodeIds)
                } catch (e) {
                    console.log('Error while trying to remove nodes', e)
                }
            },
            isNodeCrashedBefore(newNode) {
                console.log('Checking crashed node', newNode)
                return Object.values(G.nodes.active).find((node) => {
                    if (
                        node.nodeIpInfo.externalIp === newNode.nodeIpInfo.externalIp &&
                        node.nodeIpInfo.externalPort === newNode.nodeIpInfo.externalPort
                    ) {
                        return true
                    }
                })
            },
            findCrashedSyncingNode(newNode) {
                for (let nodeId in G.nodes.syncing) {
                    const {externalIp, externalPort} = G.nodes.syncing[nodeId].nodeIpInfo
                    if (newNode.nodeIpInfo.externalIp === externalIp && newNode.nodeIpInfo.externalPort === externalPort && newNode.nodeId !== nodeId) {
                        console.log('Found crashed syncing node by ip:port')
                        return G.nodes.syncing[nodeId]
                    }
                }
            },
            async updateNodes() {
                try {
                    let changes = await this.fetchChanges()
                    console.log(`Total of ${Object.keys(changes.nodes.active).length}/${Object.keys(G.nodes.active).length} nodes updated.`)
                    this.updateNetworkStatus(changes)
                    let updatedNodes = []
                    let updatedNodesMap = []
                    let newNodes = []
                    let newNodesMap = []
                    let crashedNodesToRemove = []
                    for (let nodeId in changes.nodes.active) {
                        let node = changes.nodes.active[nodeId]
                        if (!G.nodes.active[nodeId]) {
                            // console.log('New active node', node)
                            G.nodes.active[nodeId] = node
                            if (!G.nodes.syncing[nodeId]) newNodesMap[nodeId] = node
                            continue
                        }
                        let updatedVisNode = this.getUpdatedVisNode(nodeId, node)
                        updatedNodesMap[nodeId] = updatedVisNode
                        if (G.nodes.syncing[nodeId]) delete G.nodes.syncing[nodeId]
                    }

                    for (let nodeId in changes.nodes.syncing) {
                        let node = changes.nodes.syncing[nodeId]
                        node.nodeId = nodeId
                        let crashedSyncingNode = this.findCrashedSyncingNode(node)
                        if (crashedSyncingNode) {
                            console.log('Removing crashed syncing node', crashedSyncingNode)
                            delete G.nodes.syncing[crashedSyncingNode.nodeId]
                            G.data.remove(crashedSyncingNode.nodeId)
                        }
                        if (!G.nodes.syncing[nodeId]) {
                            console.log('New syncing node')
                            G.nodes.syncing[nodeId] = node
                            newNodesMap[nodeId] = node

                            // check if node is crashed before and stuck as red circle
                            const crashedNode = this.isNodeCrashedBefore(node)
                            if (crashedNode) {
                                console.log('Found crashed node', crashedNode)
                                crashedNodesToRemove.push(crashedNode)
                            }
                            continue
                        }
                        let updatedVisNode = this.getUpdatedVisNode(nodeId, node)
                        updatedNodesMap[nodeId] = updatedVisNode
                    }
                    // draw new active + synicng nodes
                    newNodes = Object.values(newNodesMap)
                    this.addNewNodesIntoNetwork(newNodes)

                    // update existing active + syncing nodes
                    updatedNodes = Object.values(updatedNodesMap)
                    G.data.update(updatedNodes)

                    // delete removed nodes
                    await this.deleteRemovedNodes()

                    // delete crashed nodes
                    if (crashedNodesToRemove.length > 0)
                        this.deleteCrashedNodes(crashedNodesToRemove)
                    G.lastUpdatedTimestamp = Date.now()
                    if (this.shouldChangeNodesSize()) this.changeNodesSize()
                } catch (e) {
                    console.log('Error while trying to update nodes.', e)
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
                return newNodeSize !== G.currentNodeSize
            },

            getTitle(nodeId, node) {
                try {
                    return this.htmlTitle(`
            <p><strong>NodeId</strong>: ${nodeId}</p>
            <p><strong>IP Address</strong>: ${node.nodeIpInfo.externalIp}:${node.nodeIpInfo.externalPort}</p>
            <p><strong>NodeList Hash</strong>: ${node.nodelistHash}</p>
            <p><strong>CycleMaker Hash</strong>: ${node.cycleMarker}</p>
            `)
                } catch (e) {
                    console.log('Unable to get Node title', e)
                    console.log(nodeId, node)
                }
            },

            changeNodesSize() {
                const nodeSize = this.getNodeSize(Object.keys(G.nodes.active).length)
                const options = {
                    nodes: {
                        // size: 2,
                        size: nodeSize
                    },
                    interaction: {
                        zoomSpeed: 0.1,
                        zoomView: true
                    }
                }
                G.network.setOptions(options)
                G.network.redraw()
                G.currentNodeSize = nodeSize
            },
            changeNodeColor() {
                try {
                    let updatedNodes = []
                    for (let nodeId in G.nodes.active) {
                        let node = G.nodes.active[nodeId]
                        let updatedVisNode = this.getUpdatedVisNode(nodeId, node)
                        updatedNodes.push(updatedVisNode)
                    }
                    G.data.update(updatedNodes)
                } catch (e) {
                    console.log('Error while trying to update nodes.', e)
                }
            },
            average(list) {
                if (list.length === 0) return 0
                const total = list.reduce((p, c) => p + c, 0)
                return total / list.length
            },
            // mode(list) {
            //     const arr = [...list]
            //     return arr
            //         .sort(
            //             (a, b) =>
            //                 arr.filter((v) => v === a).length - arr.filter((v) => v === b).length
            //         )
            //         .pop()
            // },
            mode(arr) {
                return arr.reduce(function (current, num) {
                    const freq = (num in current.numMap) ? ++current.numMap[num] : (current.numMap[num] = 1)
                    if (freq > current.modeFreq && freq > 1) {
                        current.modeFreq = freq
                        current.mode = num
                    }
                    return current
                }, {mode: null, modeFreq: 0, numMap: {}}).mode
            },
            async getRandomArchiver() {
               if (Object.keys(G.nodes.active).length === 0) return
                const randomConsensorNode = Object.values(G.nodes.active)[0]
                let res = await axios.get(`http://${randomConsensorNode.nodeIpInfo.externalIp}:${randomConsensorNode.nodeIpInfo.externalPort}/sync-newest-cycle`)
                let cycle = res.data.newestCycle
                if (cycle.refreshedArchivers && cycle.refreshedArchivers.length > 0) {
                    G.archiver = cycle.refreshedArchivers[0]
                }
            },
            async getActiveArchivers() {
               if (!G.archiver) await this.getRandomArchiver()
                const res = await axios.get(`http://${G.archiver.ip}:${G.archiver.port}/archiverlist`)
                if (res.data.archivers && res.data.archivers.length > 0) {
                   return res.data.archivers
                }
            },
            async drawArchiverNetwork() {
                const activeArchivers = await this.getActiveArchivers()
                let newArchiverNodes = this.getNewArchiverVisNodes(activeArchivers)
                G.archivers = activeArchivers
                G.archiverData = new vis.DataSet(newArchiverNodes)
                const archiverContainer = document.getElementById('myarchiver')
                let archiverData = {
                    nodes: G.archiverData
                }
                const options = {
                    nodes: {
                        shape: 'dot',
                        size: 5,
                        font: {
                            size: 12,
                            face: 'Arial'
                        }
                    },
                    interaction: {
                        zoomSpeed: 0.1,
                        hover: false,
                        zoomView: false
                    }
                }
                G.archiverNetwork = new vis.Network(archiverContainer, archiverData, options)
                G.archiverNetwork.on('click', (params) => {
                    const publicKey = params.nodes[0]
                    const archiver = G.archivers.find(a => a.publicKey === publicKey)
                    if (!archiver) return
                    window.open(
                        `http://${archiver.ip}:${archiver.port}/nodeinfo`
                    )
                })
            },
            async start() {
                let res = await axios.get(`${monitorServerUrl}/report`)
                let newNodesMap = {}
                let newNodes = []
                for (let nodeId in res.data.nodes.active) {
                    // remove if active node exists in the syncing list
                    if (G.nodes.syncing[nodeId]) {
                        console.log('Found this active node in syncing list. Removing it from syncing list.')
                        delete G.nodes.syncing[nodeId]
                    }
                    let node = res.data.nodes.active[nodeId]
                    newNodesMap[nodeId] = this.getNewVisNode(nodeId, node)
                    G.nodes.active[nodeId] = node
                }
                for (let nodeId in res.data.nodes.syncing) {
                    let node = res.data.nodes.syncing[nodeId]
                    node.nodeId = nodeId
                    newNodesMap[nodeId] = this.getNewVisNode(nodeId, node)
                    G.nodes.syncing[nodeId] = node
                }
                newNodes = Object.values(newNodesMap)
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
                    },
                    interaction: {
                        zoomSpeed: 0.1,
                        zoomView: true
                    }
                }

                // initialize your network!
                G.network = new vis.Network(container, data, options)
                G.currentNodeSize = this.getNodeSize(Object.keys(G.nodes.active).length)
                G.network.on('click', (params) => {
                    const nodeId = params.nodes[0]
                    const node = G.nodes.active[nodeId]
                    if (!node) return
                    window.open(
                        `/log?ip=${node.nodeIpInfo.externalIp}&port=${node.nodeIpInfo.externalPort}`
                    )
                })
                await this.drawArchiverNetwork()
                setInterval(this.updateNodes, 10000)
            }
        }
    })
})()
