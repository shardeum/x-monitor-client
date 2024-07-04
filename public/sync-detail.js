;(function main() {
    const G = {}
    loadToken(G)
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    G.VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    G.R = 100
    G.X = 0
    G.Y = 0
    G.MAX_EDGES_FOR_NODE = 1
    G.REFRESH_TIME = 10000
    G.maxId = parseInt('ffff', 16)
    G.lastUpdatedTimestamp = 0
    G.nodes = {
        joining: {},
        syncing: {},
        active: {},
        standby: {},
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
                    standby: 0,
                    joining: 0,
                    counter: 0,
                    desired: 0,
                    tps: 0,
                    maxTps: 0,
                    processed: 0,
                    rejected: 0,
                    rejectedTps: 0,
                    netLoad: 0,
                    load: 0,
                    totalLoad: 0,
                    maxLoad: 0,
                    queueLength: 0,
                    totalQueueLength: 0,
                    queueTime: 0,
                    totalQueueTime: 0,
                    expiredTx: 0,
                },
                colorMode: 'state',
                animateTransactions: false,
                queueDetails: false,
                nodeLoads: [],
                sortKey: 'ip',
                sortAsc: true,
                shouldRefresh: true,
                hideEdgeOOS: false,
            }
        },
        async mounted() {
            console.log('Mounted')
            this.start()
        },
        computed: {
            sortedNodes() {
                return this.nodeLoads.sort((a, b) => {
                    let modifier = this.sortAsc ? 1 : -1
                    if (a[this.sortKey] < b[this.sortKey]) return -1 * modifier
                    if (a[this.sortKey] > b[this.sortKey]) return 1 * modifier
                    return 0
                })
            },
        },
        methods: {
            async fetchChanges() {
                let res = await requestWithToken(
                    `${monitorServerUrl}/report?timestamp=${G.lastUpdatedTimestamp}`
                )
                return res.data
            },
            changeShouldRefresh() {
                this.shouldRefresh = !this.shouldRefresh
            },
            changeHideEdgeOOS() {
                this.hideEdgeOOS = !this.hideEdgeOOS
            },
            filterOutCrashedNodes(report) {
                let filterdActiveNodes = {}
                for (let nodeId in report.nodes.active) {
                    const node = report.nodes.active[nodeId]
                    let age = Date.now() - node.timestamp
                    if (age <= 60000) {
                        filterdActiveNodes[nodeId] = node
                    }
                }
                console.log('filtered active nodes', Object.keys(filterdActiveNodes).length)
                report.nodes.active = { ...filterdActiveNodes }
            },
            updateNetworkStatus(report) {
                if (Object.keys(report.nodes.active).length === 0) return // don't update stats if no nodes send the
                let reportPercentage =
                    Object.keys(report.nodes.active).length / Object.keys(G.nodes.active).length
                console.log('reportPercentage', reportPercentage)
                if (reportPercentage < 0.3) return // don't update stats if less than 30% of network updates

                this.nodeLoads = []

                for (let nodeId in report.nodes.active) {
                    const node = report.nodes.active[nodeId]
                    const result = node.lastInSyncResult

                    this.nodeLoads.push({
                        id: nodeId,
                        ip: node.nodeIpInfo.externalIp,
                        port: node.nodeIpInfo.externalPort,
                        inSync: result.insync,
                        total: result.stats.total,
                        good: result.stats.good,
                        bad: result.stats.bad,
                        radixes: result.radixes,
                        stillNeedsInitialPatchPostActive: node.stillNeedsInitialPatchPostActive,
                        cycleFinishedSyncing: node.cycleFinishedSyncing,
                    })
                }
            },
            radixClass(r) {
                if (this.hideEdgeOOS && r.inConsensusRange && !r.inEdgeRange) {
                    return 'inconsensus-oosync';
                }
                if (r.recentRuntimeSync) {
                    return 'recent-runtime-sync';
                }
                return r.insync ? 'insync' : 'oosync';
            },
            sortTable(key) {
                if (this.sortKey === key) {
                    this.sortAsc = !this.sortAsc
                } else {
                    this.sortKey = key
                    this.sortAsc = true
                }
            },
            async updateNodes() {
                if (!this.shouldRefresh) return

                try {
                    let changes = await this.fetchChanges()
                    console.log(
                        `Total of ${Object.keys(changes.nodes.active).length}/${
                            Object.keys(G.nodes.active).length
                        } nodes updated.`
                    )
                    this.filterOutCrashedNodes(changes)
                    console.log(
                        'number of active nodes after filter',
                        Object.keys(changes.nodes.active).length
                    )
                    this.updateNetworkStatus(changes)
                } catch (e) {
                    console.log('Error while trying to update nodes.', e)
                }
            },
            async start() {
                let res = await requestWithToken(`${monitorServerUrl}/report`)
                let report = res.data
                this.filterOutCrashedNodes(report)
                this.updateNetworkStatus(res.data)

                setInterval(this.updateNodes, G.REFRESH_TIME)
            },
        },
    })
})()
