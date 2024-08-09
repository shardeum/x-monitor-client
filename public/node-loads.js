(function main() {
  const G = {}
  loadToken(G)
  G.monitorServerUrl = monitorServerUrl || `https://127.0.0.1:3000/api`
  G.REFRESH_TIME = 10000

  new Vue({
      el: '#app',
      data() {
          return {
              nodeLoads: [],
              sortKey: 'ip',
              sortAsc: true,
          }
      },
      computed: {
          sortedNodes() {
              return this.nodeLoads.sort((a, b) => {
                  let modifier = this.sortAsc ? 1 : -1
                  const valueA = a[this.sortKey]
                  const valueB = b[this.sortKey]

                  if (typeof valueA === 'number' && typeof valueB === 'number') {
                      return (valueA - valueB) * modifier
                  }

                  if (valueA < valueB) return -1 * modifier
                  if (valueA > valueB) return 1 * modifier
                  return 0
              })
          },
      },
      methods: {
          sortTable(key) {
              if (this.sortKey === key) {
                  this.sortAsc = !this.sortAsc
              } else {
                  this.sortKey = key
                  this.sortAsc = true
              }
          },
          async fetchChanges() {
              let res = await requestWithToken(
                  `${G.monitorServerUrl}/report?timestamp=${G.lastUpdatedTimestamp}`
              )
              return res.data
          },
          updateNetworkStatus(report) {
              this.nodeLoads = []
              for (let nodeId in report.nodes.active) {
                  const node = report.nodes.active[nodeId]
                  this.nodeLoads.push({
                      id: nodeId,
                      ip: node.nodeIpInfo.externalIp,
                      port: node.nodeIpInfo.externalPort,
                      loadInternal: node.currentLoad.nodeLoad.internal.toFixed(3),
                      loadExternal: node.currentLoad.nodeLoad.external.toFixed(3),
                      queueLengthAll: node.queueLengthAll,
                      queueLength: node.queueLength,
                      bucket15: node.queueLengthBuckets.c15,
                      bucket60: node.queueLengthBuckets.c60,
                      bucket120: node.queueLengthBuckets.c120,
                      bucket600: node.queueLengthBuckets.c600,
                      avgQueueTime: node.txTimeInQueue.toFixed(3),
                      maxQueueTime: node.maxTxTimeInQueue.toFixed(3),
                  })
              }
          },
          async updateNodes() {
              try {
                  let changes = await this.fetchChanges()
                  this.updateNetworkStatus(changes)
              } catch (e) {
                  console.log('Error while trying to update nodes.', e)
              }
          },
          start() {
              this.updateNodes()
              setInterval(this.updateNodes, G.REFRESH_TIME)
          },
      },
      mounted() {
          console.log('Mounted')
          this.start()
      },
  })
})()