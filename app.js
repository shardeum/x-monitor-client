window.$ = function (selector) {
    // shorthand for query selector
    const elements = document.querySelectorAll(selector)
    if (elements.length === 1) return elements[0]
    return elements
}

const { tween, styler, listen, pointer, timeline, easing, chain } = window.popmotion

const NetworkMonitor = function (config) {
    const G = {} // semi-global namespace
    G.nodes = []
    G.partitionMatrix = {}
    G.partitionGraphic = {}
    G.partitionButtons = {}
    G.nodeSyncState = {}
    G.currentCycleCounter = 0
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
    G.VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)

    G.R = config.networkCircleRadius || 200
    G.X = config.networkCircleX || G.VW / 2
    G.Y = config.networkCircleY || G.VH / 2
    G.nodeRadius = config.nodeRadius || 200
    G.monitorServerUrl = config.monitorServerUrl || `https://127.0.0.1:3000/api`
    G.environment = config.environment || `production`
    G.maxId = parseInt('ffff', 16)
    G.joining = {}
    G.syncing = {}
    G.active = {}
    G.colors = {
        joining: '#999',
        syncing: '#f9cb35',
        active: '#16c716',
        transaction: '#f55555cc',
        tooltip: '#5f5f5fcc',
    }
    G.txAnimationSpeed = 800
    G.stateCircleRadius = G.nodeRadius / 2.5
    G.nodeToForward = 4
    G.generatedTxArray = {}
    G.reportInterval = 1000
    G.crashedNodes = {}
    G.lostNodes = {}
    G.smallToolTipShown = false
    G.maxNodeCount = config.maxNodeCount || 200

    // setting desired fps
    createjs.Ticker.interval = parseInt(1000 / config.fps)

    let testNodeCount = 0
    const testNodeLimit = 1000

    let report = {
        nodes: {
            joining: {},
            syncing: {},
            active: {},
        },
    }

    const resetState = () => {
        for (let counter in G.partitionButtons) {
            clearPartitionButton(counter)
            clearPartitionGraphic(counter)
        }
        for (const nodeId in G.active) {
            removeNodeFromNetwork(nodeId)
        }
        for (const nodeId in G.syncing) {
            removeNodeFromNetwork(nodeId)
        }
        for (const nodeId in G.joining) {
            removeNodeFromNetwork(nodeId)
        }
        G.nodes = []
        G.partitionMatrix = {}
        G.partitionGraphic = {}
        G.partitionButtons = {}
        G.nodeSyncState = {}
        G.active = {}
        G.syncing = {}
        G.joining = {}
        G.currentCycleCounter = 0
    }

    const generateHash = function (num) {
        const table = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']
        let hash = ''
        for (let i = 0; i < num; i++) {
            const randomIndex = Math.floor(Math.random() * table.length)
            hash += table[randomIndex]
        }
        return hash
    }

    const generateNodeForTesting = function () {
        const hash = generateHash(64)
        const nodeId = generateHash(64)
        // report.nodes.joining[hash] = {
        //   nodeIpInfo: {
        //     internalIp: '127.0.0.1',
        //     internalPort: '9000',
        //     externalIp: '123.4.5.6',
        //     externalPort: '10000'
        //   }
        // }
        // setTimeout(() => {
        //   report.nodes.syncing[nodeId] = {
        //     publicKey: hash,
        //     nodeIpInfo: {
        //       internalIp: '127.0.0.1',
        //       internalPort: '9000',
        //       externalIp: '123.4.5.6',
        //       externalPort: '10000'
        //     }
        //   }
        // }, 2000)
        // setTimeout(() => {
        //   delete report.nodes.joining[hash]
        // }, 4000)

        setTimeout(() => {
            report.nodes.active[nodeId] = {
                appState: generateHash(64),
                nodelistHash: generateHash(64),
                cycleMarker: generateHash(64),
                cycleCounter: Math.random(),
                txInjected: 0,
                txApplied: Math.random() * 0,
                txRejected: Math.random(),
                txExpired: Math.random(),
                desiredNodes: Math.random(),
                reportInterval: 2,
                nodeIpInfo: {
                    externalIp: '127.0.0.1',
                    externalPort: 3000,
                },
            }
        }, 100)
        // setTimeout(() => {
        //   delete report.nodes.syncing[nodeId]
        // }, 8000)
    }

    const removeNodeForTesting = function () {
        const activeNodes = Object.keys(report.nodes.active)
        let firstNodeId
        if (activeNodes.length > 5) firstNodeId = Object.keys(report.nodes.active)[0]
        delete report.nodes.active[firstNodeId]
    }

    let totalTxRejected = 0
    let totalTxExpired = 0

    let loadDuringLast2Report = 0
    let injectedLoadCollector = []

    let avgTps = 0
    let maxTps = 0
    let lastTotalProcessed = 0

    const init = async function () {
        drawNetworkCycle(G.R, G.X, G.Y)
        $('#reset-report').addEventListener('click', flushReport)
        if (G.environment === 'test') {
            const addNodeInterval = setInterval(() => {
                generateNodeForTesting()
                testNodeCount += 1
                if (testNodeCount > testNodeLimit) clearInterval(addNodeInterval)
            }, 100)
            // let removeNodeInterval = setInterval(() => {
            // 	removeNodeForTesting()
            // }, 6000)
        }

        // FOR TESTING ONLY
        // let nodeDead = false
        // setTimeout(() => {
        //   nodeDead = true
        // }, 10000)

        setTimeout(() => {
            updateReport()
        }, G.reportInterval)
    }

    async function updateReport() {
        let newCycleCounter
        if (G.environment === 'production') {
            try {
                report = await getReport()
            } catch (e) {
                console.warn('Error while getting report from monitor server')
                resetState()
                return
            }
        }
        // FOR TESTING ONLY
        // for (let nodeId in report.nodes.active) {
        //   if (!nodeDead) report.nodes.active[nodeId].timestamp = Date.now()
        //   else if (nodeDead) {
        //     console.log('node crashed...')
        //     report.nodes.active[nodeId].timestamp = Date.now() - 20000
        //   }
        // }
        for (const publicKey in report.nodes.joining) {
            if (!G.joining[publicKey]) {
                // Pass in a list of positions to avoid overlapping grey cicles
                const existingPositions = Object.values(G.joining).map((node) => node.realPosition)
                G.joining[publicKey] = createNewNode(
                    'joining',
                    publicKey,
                    existingPositions,
                    report.nodes.joining[publicKey].nodeIpInfo
                )
                G.joining[publicKey].tooltipInstance = drawToolipForInactiveNodes(
                    G.joining[publicKey]
                )
            }
        }

        for (const nodeId in report.nodes.syncing) {
            const publicKey = report.nodes.syncing[nodeId].publicKey
            if (!G.syncing[nodeId] && nodeId !== null && nodeId !== 'null') {
                if (G.joining[publicKey]) {
                    // syncing node is already drawn as gray circle
                    // console.log(`Syncing node found on joining list...`)
                    G.syncing[nodeId] = Object.assign({}, G.joining[publicKey], {
                        status: 'syncing',
                        nodeId: nodeId,
                    })
                    delete G.joining[publicKey]
                    updateUI('joining', 'syncing', publicKey, nodeId)
                    G.syncing[nodeId].tooltipInstance = null
                    G.syncing[nodeId].circle.removeAllEventListeners('mouseover')
                    G.syncing[nodeId].circle.removeAllEventListeners('mouseout')
                    G.syncing[nodeId].tooltipInstance = drawToolipForInactiveNodes(
                        G.syncing[nodeId]
                    )
                } else {
                    // syncing node is not drawn as gray circle yet
                    // console.log(`New syncing node`)
                    G.syncing[nodeId] = createNewNode(
                        'syncing',
                        nodeId,
                        [],
                        report.nodes.syncing[nodeId].nodeIpInfo
                    )
                    G.syncing[nodeId].nodeId = nodeId
                    positionNewNodeIntoNetwork('syncing', G.syncing[nodeId])
                    G.syncing[nodeId].tooltipInstance = drawToolipForInactiveNodes(
                        G.syncing[nodeId]
                    )
                }
            }
        }
        let count2 = 0
        const load = []
        const nodeLoad = []
        const txQueueLen = []
        const txQueueTime = []
        for (const nodeId in report.nodes.active) {
            report.nodes.active[nodeId].appState = '00ff00ff'
            if (
                !G.active[nodeId] &&
                nodeId !== null &&
                report.nodes.active[nodeId].appState &&
                report.nodes.active[nodeId].nodeIpInfo
            ) {
                if (G.syncing[nodeId]) {
                    // active node is already drawn as yellow circle
                    // console.log(`Active node found on syncing list...`)
                    G.active[nodeId] = Object.assign({}, G.syncing[nodeId], {
                        status: 'active',
                        nodeId: nodeId,
                    })
                    delete G.syncing[nodeId]
                    try {
                        G.active[nodeId].appState =
                            report.nodes.active[nodeId].appState || '00ff00ff'
                        G.active[nodeId].cycleMarker = report.nodes.active[nodeId].cycleMarker
                        G.active[nodeId].cycleCounter = report.nodes.active[nodeId].cycleCounter
                        G.active[nodeId].nodelistHash = report.nodes.active[nodeId].nodelistHash
                        G.active[nodeId].txInjected = report.nodes.active[nodeId].txInjected
                        G.active[nodeId].txApplied = report.nodes.active[nodeId].txApplied
                        G.active[nodeId].txRejected = report.nodes.active[nodeId].txRejected
                        G.active[nodeId].txExpired = report.nodes.active[nodeId].txExpired
                        G.active[nodeId].desiredNodes = report.nodes.active[nodeId].desiredNodes
                        G.active[nodeId].reportInterval = report.nodes.active[nodeId].reportInterval
                        G.active[nodeId].externalIp =
                            report.nodes.active[nodeId].nodeIpInfo.externalIp
                        G.active[nodeId].externalPort =
                            report.nodes.active[nodeId].nodeIpInfo.externalPort
                        G.active[nodeId].shardusVersion = report.nodes.active[nodeId].shardusVersion

                        if (!newCycleCounter) {
                            newCycleCounter = report.nodes.active[nodeId].shardusVersion
                        }
                    } catch (e) {
                        console.log(e)
                    }
                    updateUI('syncing', 'active', null, nodeId)
                    G.active[nodeId].tooltipInstance = null
                    G.active[nodeId].circle.removeAllEventListeners('mouseover')
                    G.active[nodeId].circle.removeAllEventListeners('mouseout')
                    G.active[nodeId].tooltipInstance = drawTooltip(G.active[nodeId])
                } else {
                    // syncing node is not drawn as gray circle yet
                    console.log('New active node')
                    G.active[nodeId] = createNewNode('active', nodeId)
                    G.active[nodeId].nodeId = nodeId
                    try {
                        G.active[nodeId].timestamp = report.nodes.active[nodeId].timestamp
                        G.active[nodeId].appState = report.nodes.active[nodeId].appState
                        G.active[nodeId].cycleMarker = report.nodes.active[nodeId].cycleMarker
                        G.active[nodeId].cycleCounter = report.nodes.active[nodeId].cycleCounter
                        G.active[nodeId].nodelistHash = report.nodes.active[nodeId].nodelistHash
                        G.active[nodeId].txInjected = report.nodes.active[nodeId].txInjected
                        G.active[nodeId].txApplied = report.nodes.active[nodeId].txApplied
                        G.active[nodeId].txRejected = report.nodes.active[nodeId].txRejected
                        G.active[nodeId].txExpired = report.nodes.active[nodeId].txExpired
                        G.active[nodeId].desiredNodes = report.nodes.active[nodeId].desiredNodes
                        G.active[nodeId].reportInterval = report.nodes.active[nodeId].reportInterval
                        G.active[nodeId].externalIp =
                            report.nodes.active[nodeId].nodeIpInfo.externalIp
                        G.active[nodeId].externalPort =
                            report.nodes.active[nodeId].nodeIpInfo.externalPort
                        G.active[nodeId].shardusVersion = report.nodes.active[nodeId].shardusVersion
                        G.active[nodeId].lastScalingTypeWinner =
                            report.nodes.active[nodeId].lastScalingTypeWinner
                        G.active[nodeId].lastScalingTypeRequested =
                            report.nodes.active[nodeId].lastScalingTypeRequested
                        if (report.nodes.active[nodeId].reportInterval > G.reportInterval) {
                            G.reportInterval = report.nodes.active[nodeId].reportInterval
                        }
                    } catch (e) {
                        console.log(e)
                    }
                    await positionNewNodeIntoNetwork('active', G.active[nodeId])
                    G.active[nodeId].tooltipInstance = null
                    G.active[nodeId].circle.removeAllEventListeners('mouseover')
                    G.active[nodeId].circle.removeAllEventListeners('mouseout')
                    G.active[nodeId].tooltipInstance = drawTooltip(G.active[nodeId])
                }
            } else if (G.active[nodeId] && report.nodes.active[nodeId].appState) {
                if (G.environment === 'production') {
                    load.push(
                        report.nodes.active[nodeId].currentLoad.networkLoad.toLocaleString(
                            undefined,
                            {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            }
                        )
                    )
                    nodeLoad.push(report.nodes.active[nodeId].currentLoad.nodeLoad)
                    txQueueLen.push(report.nodes.active[nodeId].queueLength)
                    txQueueTime.push(
                        report.nodes.active[nodeId].txTimeInQueue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })
                    )
                }
                if (report.nodes.active[nodeId].timestamp < Date.now() - 2 * G.reportInterval) {
                    G.active[nodeId].crashed = true
                } else {
                    G.active[nodeId].crashed = false
                }
                G.active[nodeId].isLost = report.nodes.active[nodeId].isLost ? true : false
                G.active[nodeId].isRefuted = report.nodes.active[nodeId].isRefuted ? true : false
                G.active[nodeId].timestamp = report.nodes.active[nodeId].timestamp
                G.active[nodeId].appState = report.nodes.active[nodeId].appState
                G.active[nodeId].cycleMarker = report.nodes.active[nodeId].cycleMarker
                G.active[nodeId].cycleCounter = report.nodes.active[nodeId].cycleCounter
                G.active[nodeId].nodelistHash = report.nodes.active[nodeId].nodelistHash
                G.active[nodeId].txInjected = report.nodes.active[nodeId].txInjected
                G.active[nodeId].txApplied = report.nodes.active[nodeId].txApplied
                G.active[nodeId].txRejected = report.nodes.active[nodeId].txRejected
                G.active[nodeId].txExpired = report.nodes.active[nodeId].txExpired
                G.active[nodeId].desiredNodes = report.nodes.active[nodeId].desiredNodes
                G.active[nodeId].reportInterval = report.nodes.active[nodeId].reportInterval
                G.active[nodeId].externalIp = report.nodes.active[nodeId].nodeIpInfo.externalIp
                G.active[nodeId].externalPort = report.nodes.active[nodeId].nodeIpInfo.externalPort
                G.active[nodeId].shardusVersion = report.nodes.active[nodeId].shardusVersion
                G.active[nodeId].lastScalingTypeWinner =
                    report.nodes.active[nodeId].lastScalingTypeWinner
                G.active[nodeId].lastScalingTypeRequested =
                    report.nodes.active[nodeId].lastScalingTypeRequested
                G.active[nodeId].isDataSynced = report.nodes.active[nodeId].isDataSynced
                if (report.nodes.active[nodeId].reportInterval !== G.reportInterval) {
                    G.reportInterval = report.nodes.active[nodeId].reportInterval
                    console.log('Global report interval is set to', G.reportInterval)
                }
                if (!newCycleCounter) {
                    newCycleCounter = report.nodes.active[nodeId].cycleCounter
                }
                count2++
                // console.log(` ${count2} Active node: ${nodeId.slice(0, 5)} ${G.active[nodeId].externalIp}:${G.active[nodeId].externalPort} isLost:${G.active[nodeId].isLost} crashed:${G.active[nodeId].crashed} appState:${G.active[nodeId].appState?.slice(0, 4)} cycleMarker:${G.active[nodeId].cycleMarker?.slice(0, 4)} nodelistHash:${G.active[nodeId].nodelistHash?.slice(0, 4)}`)
            }
        }
        let totalTxCircle = 0
        for (const nodeId in G.active) {
            if (!G.generatedTxArray[nodeId]) {
                G.generatedTxArray[nodeId] = []
                for (let i = 0; i < G.nodeToForward; i++) {
                    const plainTx = generatePlainTx(G.active[nodeId])
                    G.generatedTxArray[nodeId].push(plainTx)
                    totalTxCircle += 1
                }
            }
        }
        let totalTxApplied = 0
        const listOfDesiredNodes = []
        let averageTpsApplied = 0
        let modeDesiredNodes = 0
        let activeNodeCount = 0

        for (const nodeId in G.active) {
            if (nodeId !== null) {
                const isRemovedFromNetwork = checkRemoveStatus(nodeId, report.nodes)
                const isNodeCrashed = G.active[nodeId].crashed === true
                const isNodeIntact = G.active[nodeId].crashed === false
                const isNodeLost = G.active[nodeId].isLost === true
                const isNodeRefuted = G.active[nodeId].isRefuted === true

                if (isRemovedFromNetwork) removeNodeFromNetwork(nodeId)
                else if (isNodeCrashed) setNodeAsCrashed(nodeId)
                else if (isNodeLost) setNodeAsLost(nodeId)
                else if (isNodeRefuted) setNodeAsActive(nodeId)
                else {
                    if (isNodeIntact) setActiveIfCrashedBefore(nodeId)
                    const txApplied = G.active[nodeId].txApplied
                    const txRejected = G.active[nodeId].txRejected
                    const txExpired = G.active[nodeId].txExpired
                    const desiredNodes = G.active[nodeId].desiredNodes
                    totalTxApplied += txApplied
                    totalTxRejected += txRejected
                    totalTxExpired += txExpired
                    listOfDesiredNodes.push(desiredNodes)
                    activeNodeCount += 1
                }
            }
        }
        // averageTpsApplied = Math.round(totalTxApplied / activeNodeCount)
        // if (!Number.isNaN(averageTpsApplied))
        //   avgTps = report.totalProcessed - lastTotalProcessed
        // lastTotalProcessed = report.totalProcessed

        // if (avgTps > maxTps) maxTps = avgTps

        $('#current-avgtps').innerHTML = report.avgTps
        $('#current-maxtps').innerHTML = report.maxTps
        modeDesiredNodes = Math.round(mode(listOfDesiredNodes) || 0)
        $('#total-processed-txs').innerHTML = report.totalProcessed
        if (!Number.isNaN(modeDesiredNodes)) {
            $('#node-info-desired').innerHTML = modeDesiredNodes
        }
        $('#total-tx-rejected').innerHTML = report.totalRejected
        $('#total-tx-expired').innerHTML = report.totalExpired
        $('#current-load').innerHTML = calculateAverage(load)
        $('#current-internal-node-load').innerHTML = calculateAverage(
            nodeLoad.map((l) => l.internal)
        )
        $('#current-external-node-load').innerHTML = calculateAverage(
            nodeLoad.map((l) => l.external)
        )
        $('#tx-queue-length').innerHTML = calculateAverage(txQueueLen)
        $('#tx-queue-time').innerHTML = calculateAverage(txQueueTime)

        if (load.length > 0) {
            const LoadMsg = {
                // time: new Date().toLocaleTimeString('en-US'),
                injected: report.totalInjected,
                rejected: report.totalRejected,
                expired: report.totalExpired,
                applied: report.avgApplied,
                load,
            }
            const txQueueLenMsg = {
                injected: report.totalInjected,
                rejected: report.totalRejected,
                expired: report.totalExpired,
                applied: report.avgApplied,
                txQueueLen,
            }
            const txQueueTimeMsg = {
                injected: report.totalInjected,
                rejected: report.totalRejected,
                expired: report.totalExpired,
                applied: report.avgApplied,
                txQueueTime,
            }
        }
        updateTables()
        let injectedCount = injectTransactions()
        updateStateCircle()
        updateMarkerCycle()
        updateNodelistCycle()
        updateScaleArrow()
        if (Object.keys(G.active).length >= G.maxNodeCount) redirectToLargeNetworkPage() // this monitor has reached
        // limit Redirect to large network page

        // if (injectedLoadCollector.length >= 2) injectedLoadCollector.shift()
        // injectedLoadCollector.push(injectedCount)
        // injectedLoadCollector.timestamp = Date.now()
        // loadDuringLast2Report = injectedLoadCollector.reduce((prev, cur) => prev + cur, 0)
        setTimeout(() => {
            updateReport()
        }, G.reportInterval)
    }

    const injectTransactions = function () {
        let injected = 0
        for (const nodeId in G.active) {
            const node = G.active[nodeId]
            if (node.crashed || node.isLost) continue // don't show injected txs for crashed node
            const txs = node.txInjected
            const interval = node.reportInterval
            let animatedInjection = 0

            if (!txs || txs === 0) continue
            injected += txs
            const injectInterval = setInterval(() => {
                const newTx = createNewTx()
                let injectedTx = createNewTxCircle(newTx, node)
                const travelDistance = distanceBtnTwoNodes(injectedTx, node, false)
                transformCircle(
                    injectedTx.circle,
                    node.currentPosition.x,
                    node.currentPosition.y,
                    null,
                    G.txAnimationSpeed
                )
                setTimeout(() => {
                    injectedTx.currentPosition = node.currentPosition
                    const randomNodes = getRandomActiveNodes(G.nodeToForward, node)
                    for (let i = 0; i < randomNodes.length; i += 1) {
                        const clonedTx = G.generatedTxArray[nodeId][i]
                        // clonedTx.circle.currentPosition = node.currentPosition
                        // clonedTx.currentPosition = node.currentPosition
                        clonedTx.data = injectedTx.data
                        forwardInjectedTx(clonedTx, randomNodes[i], node)
                    }
                    injectedTx.circle.graphics.clear()
                    stage.removeChild(injectedTx.circle)
                    //stage.update()
                    injectedTx = null
                }, G.txAnimationSpeed)
                animatedInjection += 1
                if (animatedInjection >= txs) clearInterval(injectInterval)
            }, Math.floor(interval / txs))
        }
        return injected
    }

    const updateUI = function (previousStatus, currentStatus, publicKey, nodeId) {
        if (previousStatus === 'joining' && currentStatus === 'syncing') {
            relocateIntoNetwork(previousStatus, G.syncing[nodeId])
        } else if (previousStatus === 'syncing' && currentStatus === 'active') {
            const node = G.active[nodeId]
            node.rectangel = drawStateCircle(node)
            node.markerCycle = drawCycleMarkerBox(node)
            node.nodeListCycle = drawNodeListBox(node)
            node.circle.myFill.style = G.colors.active
        }
    }

    const updateUI_old = function (previousStatus, currentStatus, publicKey, nodeId) {
        return
    }

    const updateTables = function () {
        const totalJoining = Object.keys(G.joining).length
        const totalSyncing = Object.keys(G.syncing).length
        const totalActive = Object.keys(G.active).length
        const total = totalJoining + totalSyncing + totalActive

        $('#node-info-joining').innerHTML = totalJoining
        $('#node-info-syncing').innerHTML = totalSyncing
        $('#node-info-active').innerHTML = totalActive
        $('#node-info-total').innerHTML = total

        if (Object.keys(G.active).length > 0) {
            const currentCycleMarker = G.active[Object.keys(G.active)[0]].cycleMarker
            $('#current-cyclemarker').innerHTML = `${currentCycleMarker.slice(
                0,
                4
            )}...${currentCycleMarker.slice(59, 63)}`
            const currentCycleCounter = Math.round(
                G.active[Object.keys(G.active)[0]].cycleCounter || 0
            )
            $('#current-cyclecounter').innerHTML = currentCycleCounter
        }
    }

    const drawTooltip = function (node) {
        stage.enableMouseOver(20)
        node.circle.on('click', () => {
            console.log('node clicked', node)
            console.log('url', `/log?port=${node.externalPort}`)
            window.open(`/log?ip=${node.externalIp}&port=${node.externalPort}`)
        })
        node.circle.on('mouseover', () => {
            const position = {
                x: node.currentPosition.x - 150 / 2,
                y: node.currentPosition.y - 150 - 100,
            }
            const nodeIdShort = `${node.nodeId.slice(0, 4)}...${node.nodeId.slice(59, 63)}`
            const cycleMarkerShort = `${node.cycleMarker.slice(0, 4)}...${node.cycleMarker.slice(
                59,
                63
            )}`
            const appStateShort = `${node.appState.slice(0, 4)}...${node.appState.slice(59, 63)}`
            const nodeListShort = `${node.nodelistHash.slice(0, 4)}...${node.nodelistHash.slice(
                59,
                63
            )}`
            let toolTipHeight = 255
            if (node.crashed) toolTipHeight += 23
            node.tooltipRect = drawRectangle(position, 150, toolTipHeight, 5, G.colors.tooltip)
            node.textList = []
            const marginBottom = 22
            const marginLeft = 15

            node.textList.push(
                drawText(
                    `nodeId: ${nodeIdShort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `marker: ${cycleMarkerShort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 2,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `state: ${appStateShort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 3,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `nodeList: ${nodeListShort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 4,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `ExtIp: ${node.externalIp}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 5,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `ExtPort: ${node.externalPort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 6,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `TxInjected: ${node.txInjected.toFixed(1)} tx/s`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 7,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `TxApplied: ${node.txApplied.toFixed(1)} tx/s`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 8,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `TxRejected: ${node.txRejected.toFixed(1)} tx/s`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 9,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `TxExpired: ${node.txExpired.toFixed(1)} tx/s`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 10,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `Version: ${node.shardusVersion}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 11,
                    },
                    13,
                    '#ffffff'
                )
            )
            if (node.crashed) {
                let timeDiff = Date.now() - node.timestamp
                node.textList.push(
                    drawText(
                        `LastHeartB: ${(timeDiff / 60000).toFixed(1)} min`,
                        {
                            x: position.x + marginLeft,
                            y: position.y + marginBottom * 11,
                        },
                        14,
                        '#ffffff'
                    )
                )
            }
        })

        node.circle.on('mouseout', () => {
            if (node.tooltipRect) {
                node.tooltipRect.graphics.clear()
                for (let i = 0; i < node.textList.length; i++) {
                    node.textList[i].parent.removeChild(node.textList[i])
                }
                //stage.update()
                node.textList = null
                node.tooltipRect = null
            }
        })
    }

    const drawToolipForInactiveNodes = function (node) {
        stage.enableMouseOver(20)
        node.circle.on('mouseover', () => {
            const position = {
                x: node.currentPosition.x - 150 / 2,
                y: node.currentPosition.y - 75 - 80,
            }
            let nodeIdShort
            if (node.status === 'joining') {
                nodeIdShort = `${node.publicKey.slice(0, 4)}...${node.publicKey.slice(59, 63)}`
            } else if (node.status === 'syncing') {
                nodeIdShort = `${node.nodeId.slice(0, 4)}...${node.nodeId.slice(59, 63)}`
            }
            node.tooltipRect = drawRectangle(position, 150, 120, 5, G.colors.tooltip)
            node.textList = []
            const marginBottom = 22
            const marginLeft = 15

            if (node.status === 'joining') {
                node.textList.push(
                    drawText(
                        `publicKey: ${nodeIdShort}`,
                        {
                            x: position.x + marginLeft,
                            y: position.y + marginBottom,
                        },
                        13,
                        '#ffffff'
                    )
                )
            } else {
                node.textList.push(
                    drawText(
                        `nodeId: ${nodeIdShort}`,
                        {
                            x: position.x + marginLeft,
                            y: position.y + marginBottom,
                        },
                        13,
                        '#ffffff'
                    )
                )
            }
            node.textList.push(
                drawText(
                    `ExtIp: ${node.nodeIpInfo.externalIp}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 2,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `ExtPort: ${node.nodeIpInfo.externalPort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 3,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `IntIp: ${node.nodeIpInfo.internalIp}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 4,
                    },
                    13,
                    '#ffffff'
                )
            )
            node.textList.push(
                drawText(
                    `IntPort: ${node.nodeIpInfo.internalPort}`,
                    {
                        x: position.x + marginLeft,
                        y: position.y + marginBottom * 5,
                    },
                    13,
                    '#ffffff'
                )
            )
        })

        node.circle.on('mouseout', () => {
            if (node.tooltipRect) {
                node.tooltipRect.graphics.clear()
                for (let i = 0; i < node.textList.length; i++) {
                    node.textList[i].parent.removeChild(node.textList[i])
                }
                //stage.update()
                node.textList = null
                node.tooltipRect = null
            }
        })
    }

    const updateScaleArrow = function () {
        for (const nodeId in G.active) {
            const node = G.active[nodeId]
            node.lastScalingTypeWinnerArrow = drawScaleArrow(
                node,
                node.lastScalingTypeWinner,
                'winner'
            )
            node.lastScalingTypeRequestedArrow = drawScaleArrow(
                node,
                node.lastScalingTypeRequested,
                'requested'
            )
        }
    }

    const updateStateCircle = function () {
        for (const nodeId in G.active) {
            const node = G.active[nodeId]
            if (!node.appState || !node.rectangel) {
                continue
            }
            if (node.crashed /*|| node.isLost*/) {
                continue
            }
            if (node.rectangel) {
                // update state color
                // node.rectangel.myFill.style = `#${node.appState.slice(0, 6)}`
                node.rectangel.myFill.style = getStateColor(node)
            } else {
                node.rectangel = drawStateCircle(node)
            }
        }
    }

    const updateMarkerCycle = function () {
        for (const nodeId in G.active) {
            const node = G.active[nodeId]
            if (!node.cycleMarker || !node.markerCycle) {
                continue
            }
            if (node.crashed /*|| node.isLost*/) {
                continue
            }

            if (node.cycleMarker) {
                // update cycle marker color
                node.markerCycle.myFill.style = `#${node.cycleMarker.slice(0, 6)}`
            } else {
                node.markerCycle = drawCycleMarkerBox(node)
            }
        }
    }

    const updateNodelistCycle = function () {
        for (const nodeId in G.active) {
            const node = G.active[nodeId]
            if (!node.nodelistHash || !node.nodeListCycle) {
                continue
            }
            if (node.crashed /*|| node.isLost*/) {
                continue
            }

            if (node.nodelistHash) {
                // update nodelist Hash color
                node.nodeListCycle.myFill.style = `#${node.nodelistHash.slice(0, 6)}`
            } else {
                node.nodeListCycle = drawNodeListBox(node)
            }
        }
    }

    const relocateIntoNetwork = function (previousStatus, node) {
        if (previousStatus === 'joining') {
            const networkPosition = calculateNetworkPosition(parseInt(node.nodeId.substr(0, 4), 16))
            node.despos = networkPosition.degree // set the desired position of the node
            const x = networkPosition.x
            const y = networkPosition.y
            const initialX = node.currentPosition.x
            const initialY = node.currentPosition.y
            let travelX
            let travelY

            travelX = x - initialX
            travelY = y - initialY

            const circle = node.circle
            transformCircle(circle, x, y, G.colors.syncing, 800)

            node.initialPosition = {
                x: initialX,
                y: initialY,
            }
            node.currentPosition = {
                x: x,
                y: y,
            }
            node.degree = networkPosition.degree
            // setTimeout(() => {
            //   adjustNodePosition()
            // }, 800)
        }
    }

    const positionNewNodeIntoNetwork = function (currentStatus, node) {
        if (currentStatus === 'syncing' || currentStatus === 'active') {
            node.circle.set('fill', G.colors[currentStatus])
            const networkPosition = calculateNetworkPosition(parseInt(node.nodeId.substr(0, 4), 16))
            node.despos = networkPosition.degree // set the desired position of the node
            const x = networkPosition.x
            const y = networkPosition.y
            const initialX = node.circle.x
            const initialY = node.circle.y
            let travelX
            let travelY

            travelX = x - initialX
            travelY = y - initialY
            transformCircle(node.circle, x, y, G.colors[currentStatus], 1000)
            node.initialPosition = {
                x: initialX,
                y: initialY,
            }
            node.currentPosition = {
                x: x,
                y: y,
            }
            node.degree = networkPosition.degree

            if (currentStatus === 'active') {
                node.rectangel = drawStateCircle(node)
                node.markerCycle = drawCycleMarkerBox(node)
                node.nodeListCycle = drawNodeListBox(node)
            }

            // setTimeout(() => {
            //   adjustNodePosition()
            // }, 1100)
        }
    }

    const removeNodeFromNetwork = function (nodeId) {
        const node = G.active[nodeId]
        const x = G.X + 3.5 * (node.currentPosition.x - G.X)
        const y = G.Y + 3.5 * (node.currentPosition.y - G.Y)
        const initialX = node.initialPosition.x
        const initialY = node.initialPosition.y
        let travelX
        let travelY
        // let circleStyler = styler(node.circle)
        // let animationStartX = node.currentPosition.x - initialX
        // let animationStartY = node.currentPosition.y - initialY

        travelX = x - node.currentPosition.x
        travelY = y - node.currentPosition.y

        if (travelX === 0 && travelY === 0) {
            return
        }

        if (node.status === 'active') {
            const radius = G.stateCircleRadius
            // move app state circle
            transformCircle(node.rectangel, x, y + radius, null, 1000)
            transformCircle(node.markerCycle, x + radius, y - radius, null, 1000)
            transformCircle(node.nodeListCycle, x - radius, y - radius, null, 1000)
        }

        // move the node
        transformCircle(node.circle, x, y, null, 1000)

        setTimeout(() => {
            node.circle.graphics.clear()
            node.rectangel.graphics.clear()
            node.nodeListCycle.graphics.clear()
            node.markerCycle.graphics.clear()
            clearArrow(node.lastScalingTypeWinnerArrow)
            clearArrow(node.lastScalingTypeRequestedArrow)
            //stage.update()
        }, 1000)
        delete G.active[nodeId]
    }
    const setNodeAsCrashed = function (nodeId) {
        if (G.crashedNodes[nodeId]) return
        const node = G.active[nodeId]
        const redColor = '#e61c1c'
        if (node.crashed === true) {
            changeCircleColor(node.circle, redColor, 1000)
            changeCircleColor(node.rectangel, redColor, 1000)
            changeCircleColor(node.markerCycle, redColor, 1000)
            changeCircleColor(node.nodeListCycle, redColor, 1000)
            G.crashedNodes[nodeId] = true
        }
    }
    const setNodeAsLost = function (nodeId) {
        if (G.lostNodes[nodeId]) return
        const node = G.active[nodeId]
        const darkColor = '#34495e'
        if (node.isLost === true) {
            changeCircleColor(node.circle, darkColor, 1000)
            G.lostNodes[nodeId] = true
        }
    }
    const setNodeAsActive = function (nodeId) {
        if (G.lostNodes[nodeId]) {
            delete G.lostNodes[nodeId]
            const node = G.active[nodeId]
            if (node) {
                changeCircleColor(node.circle, G.colors.active, 1000)
            }
        }
    }
    const setActiveIfCrashedBefore = function (nodeId) {
        if (G.crashedNodes[nodeId]) {
            const node = G.active[nodeId]
            const greenColor = G.colors.active
            if (node.crashed === false) {
                changeCircleColor(node.circle, greenColor, 1000)
                delete G.crashedNodes[nodeId]
            }
        }
    }

    const createNewNode = function (type, id, existingPositions = [], nodeIpInfo = null) {
        function isTooClose(position, existingPositions) {
            if (existingPositions.length < 1) return false
            for (const existingPosition of existingPositions) {
                if (distanceBtnTwoPoints(position, existingPosition) < 1 * G.nodeRadius) {
                    return true
                }
            }
            return false
        }

        let position = getJoiningNodePosition(id)
        // Make sure this position doesn't overlap an existing one
        while (isTooClose(position, existingPositions)) {
            position = getJoiningNodePosition(generateHash(64))
        }
        let circle
        if (type === 'joining') {
            // const networkPosition = calculateNetworkPosition(
            //   parseInt(id.substr(0, 4), 16)
            // )
            // circle = drawCircle(position, G.nodeRadius, G.colors["joining"], 2, id, 1.0);
            circle = drawCircle(
                {
                    x: 0,
                    y: 0,
                },
                G.nodeRadius,
                G.colors.joining,
                2,
                id,
                0.1
            )
            const node = {
                circle: circle,
                status: type,
                currentPosition: circle,
                realPosition: position,
            }
            growAndShrink(circle, position)
            if (type === 'joining') node.publicKey = id
            if (nodeIpInfo) node.nodeIpInfo = nodeIpInfo
            return node
        } else {
            const circle = drawCircle(position, G.nodeRadius, G.colors[type], 2, id)
            const node = {
                circle: circle,
                status: type,
                currentPosition: circle,
                realPosition: position,
            }
            if (type === 'joining') node.publicKey = id
            if (nodeIpInfo) node.nodeIpInfo = nodeIpInfo
            return node
        }
    }

    const createNewTx = function () {
        return {
            timestamp: Date.now(),
        }
    }

    const createNewTxCircle = function (inputTx = null, toNode) {
        const x = G.X + 1.5 * (toNode.currentPosition.x - G.X)
        const y = G.Y + 1.5 * (toNode.currentPosition.y - G.Y)
        const circle = drawCircle(
            {
                x: x,
                y: y,
            },
            5,
            G.colors.transaction,
            2
        )
        const currentPosition = circle.currentPosition
        const tx = {
            circle: circle,
            currentPosition,
            data: inputTx,
        }
        return tx
    }

    const generatePlainTx = function (node) {
        const x = node.currentPosition.x
        const y = node.currentPosition.y
        const circle = drawCircle(
            {
                x: x,
                y: y,
            },
            5,
            G.colors.transaction,
            2
        )
        const currentPosition = {
            x,
            y,
        }
        const tx = {
            circle: circle,
            currentPosition,
            data: null,
        }
        tx.circle.currentPosition = currentPosition
        tx.circle.visible = false
        return tx
    }

    const getStateColor = function (node) {
        if (node.isDataSynced != null) {
            if (node.isDataSynced) return '#00ff00ff'
            else return '#f8cf37'
        } else {
            return G.colors.active
        }
    }

    const cloneTxCircle = function (injectedTx) {
        const circle = drawCircle(injectedTx.currentPosition, 5, G.colors.transaction)
        // let cloneTx = Object.assign({}, injectedTx)
        // cloneTx.circle = circle
        const cloneTx = {}
        cloneTx.circle = injectedTx.circle.clone()
        cloneTx.circle.currentPosition = injectedTx.currentPosition
        cloneTx.data = injectedTx.data
        cloneTx.currentPosition = injectTransactions.currentPosition
        return cloneTx
    }

    const drawStateCircle = function (node) {
        if (!node.appState) return
        const radius = G.stateCircleRadius
        const stateCircle = drawCircle(
            {
                x: node.currentPosition.x,
                y: node.currentPosition.y + radius,
            },
            radius,
            getStateColor(node),
            null,
            null,
            0.1
        )
        animateFadeIn(stateCircle, 500, 1000)
        return stateCircle
    }

    const drawCycleMarkerBox = function (node) {
        if (!node.cycleMarker) return

        const radius = G.stateCircleRadius
        const x = 2 * radius * Math.cos(Math.PI / 4)
        const y = 2 * radius * Math.sin(Math.PI / 4)

        const cycleMarkerCircle = drawCircle(
            {
                x: node.currentPosition.x + radius,
                y: node.currentPosition.y - radius,
            },
            radius,
            `#${node.cycleMarker.slice(0, 6)}`,
            null,
            null,
            0.1
        )
        animateFadeIn(cycleMarkerCircle, 500, 1000)
        return cycleMarkerCircle
    }

    const drawNodeListBox = function (node) {
        if (!node.nodelistHash) return

        const radius = G.stateCircleRadius
        const x = 2 * radius * Math.cos(Math.PI / 4)
        const y = 2 * radius * Math.sin(Math.PI / 4)

        const nodeListCircle = drawCircle(
            {
                x: node.currentPosition.x - radius,
                y: node.currentPosition.y - radius,
            },
            radius,
            `#${node.nodelistHash.slice(0, 6)}`,
            null,
            null,
            0.1
        )
        animateFadeIn(nodeListCircle, 500, 1000)
        return nodeListCircle
    }

    const drawCircle = function (position, radius, fill, stroke, id, alpha) {
        var circle = new createjs.Shape()
        var myFill = circle.graphics.beginFill(fill).command
        // circle.graphics.beginFill(fill).drawCircle(position.x, position.y, radius);
        circle.graphics.drawCircle(position.x, position.y, radius)
        if (alpha) circle.alpha = alpha
        circle.myFill = myFill
        circle.name = generateHash(4)
        stage.addChild(circle)
        circle.currentPosition = position
        //stage.update()
        return circle
    }

    const drawTriangle = function (position, radius, angle, fill, alpha) {
        var triangle = new createjs.Shape()
        var myFill = triangle.graphics.beginFill(fill).command
        triangle.graphics.beginFill(fill).drawPolyStar(position.x, position.y, radius, 3, 0, angle)
        if (alpha) triangle.alpha = alpha
        triangle.myFill = myFill
        triangle.name = generateHash(4)
        stage.addChild(triangle)
        triangle.currentPosition = position
        //stage.update()
        return triangle
    }

    const drawRectangle = function (position, width, height, borderRadius, fill) {
        var rect = new createjs.Shape()
        var myFill = rect.graphics.beginFill(fill).command
        rect.graphics.drawRoundRectComplex(
            position.x,
            position.y,
            width,
            height,
            borderRadius,
            borderRadius,
            borderRadius,
            borderRadius
        )
        rect.myFill = myFill
        rect.name = generateHash(4)
        stage.addChild(rect)
        //stage.update()
        return rect
    }

    let lastTickTimestamp = null

    const drawText = function (message, position, fontSize, fontColor) {
        var text = new createjs.Text(message, `${fontSize}px Arial`, fontColor)
        text.x = position.x
        text.y = position.y
        text.textBaseline = 'alphabetic'
        stage.addChild(text)
        //stage.update()
        return text
    }

    const drawScaleArrow = function (node, scaleType, winnerOrRequested) {
        if (!scaleType) {
            return
        }
        const radius = G.stateCircleRadius
        const angle = scaleType === 'up' ? -90 : 90
        const color = scaleType === 'up' ? '#f1c40f' : '#3498db'
        const xOffset = winnerOrRequested === 'winner' ? radius : -1 * radius
        const size = winnerOrRequested === 'winner' ? 1.5 * radius : radius
        const Triangle = drawTriangle(
            {
                x: node.currentPosition.x + xOffset,
                y: node.currentPosition.y - 4 * radius,
            },
            size,
            angle,
            color,
            0.1
        )
        animateFadeIn(Triangle, 500, 1000)
        setTimeout(() => {
            clearArrow(Triangle)
        }, 2000)

        return Triangle
    }

    /*
    x = x cordinate of target position
    y = y cordinate of target position
    circle = cirlce to transform
    */
    function transformCircle(circle, x, y, fill, duration) {
        const travelX = x - circle.currentPosition.x
        const travelY = y - circle.currentPosition.y

        if (fill) {
            setTimeout(() => {
                circle.myFill.style = fill
            }, duration / 2)
        }
        createjs.Tween.get(circle, {
            loop: false,
        }).to(
            {
                x: travelX,
                y: travelY,
            },
            duration,
            createjs.Ease.linear
        )
        //createjs.Ticker.framerate = 30
        createjs.Ticker.addEventListener('tick', stage)
        // createjs.Ticker.addEventListener("tick", tick);
    }

    function tick() {
        let frameInterval = 100
        if (!lastTickTimestamp || Date.now() - lastTickTimestamp > frameInterval) {
            stage.update()
            lastTickTimestamp = Date.now()
        }
    }

    function changeCircleColor(circle, fill, duration) {
        if (fill) {
            setTimeout(() => {
                circle.myFill.style = fill
            }, duration / 2)
        }
        //createjs.Ticker.framerate = 30
        //createjs.Ticker.addEventListener('tick', stage)
    }

    function animateFadeIn(circle, duration, wait) {
        createjs.Tween.get(circle, {
            loop: false,
        })
            .wait(wait)
            .to(
                {
                    alpha: 1.0,
                },
                duration,
                createjs.Ease.linear
            )
        //createjs.Ticker.framerate = 30
        //createjs.Ticker.addEventListener('tick', stage)
    }

    function growAndShrink(rec, position) {
        rec.scaleX = 0.5
        rec.scaleY = 0.5
        rec.x = position.x
        rec.y = position.y
        rec.regX = rec.radius / 4
        rec.regY = rec.radius / 4
        let duration = Math.random() * 800
        duration = duration < 400 ? 400 : duration

        createjs.Tween.get(rec, {
            loop: false,
        })
            .to(
                {
                    scale: 1.4,
                    alpha: 0.5,
                },
                duration,
                createjs.Ease.linear
            )
            .to(
                {
                    scale: 1.0,
                    alpha: 1.0,
                },
                duration,
                createjs.Ease.linear
            )

        //createjs.Ticker.framerate = 30
        //createjs.Ticker.addEventListener('tick', stage)
    }

    const distanceBtnTwoNodes = function (node1, node2, substract) {
        const xDiff = node2.currentPosition.x - node1.currentPosition.x
        const yDiff = node2.currentPosition.y - node1.currentPosition.y
        const R = G.nodeRadius
        const radian = Math.atan(yDiff / xDiff)
        const x = R * Math.cos(radian)
        const y = R * Math.sin(radian)

        let xFactor = 1
        let yFactor = 1

        if (xDiff < 0) xFactor = -1
        if (yDiff < 0) yFactor = -1

        if (substract) {
            return {
                x: xDiff - xFactor * Math.sqrt(x * x),
                y: yDiff - yFactor * Math.sqrt(y * y),
            }
        }
        return {
            x: xDiff,
            y: yDiff,
        }

        if (substract) {
            return {
                x: node2.currentPosition.x - xFactor * Math.sqrt(x * x),
                y: node2.currentPosition.y - yFactor * Math.sqrt(y * y),
            }
        }
        return {
            x: xDiff,
            y: yDiff,
        }
    }
    const distanceBtnTwoPoints = function (p1, p2) {
        const dx = p1.x - p2.x
        const dy = p1.y - p2.y
        const distance = Math.sqrt(dx ** 2 + dy ** 2)
        return distance
    }

    const getRandomActiveNodes = function (count, excludedNode = null) {
        let nodeList = []
        for (const nodeId in G.active) {
            nodeList.push(G.active[nodeId])
        }
        const randomNodes = []
        let n
        if (excludedNode) {
            nodeList = nodeList.filter((n) => n.nodeId !== excludedNode.nodeId)
        }
        if (nodeList.length === 0) return []
        if (nodeList.length < count) n = nodeList.length
        else n = count
        for (let i = 0; i < n; i += 1) {
            const item = nodeList[Math.floor(Math.random() * nodeList.length)]
            randomNodes.push(item)
            nodeList = nodeList.filter((n) => n.nodeId !== excludedNode.nodeId)
        }
        return randomNodes
    }

    let clonedTxCircles = []
    let hideCloneTxsTimeout = null

    const hideClonedTxs = function () {
        if (clonedTxCircles.length === 0) {
            // console.log(`No cloned txs to hide`)
            if (hideCloneTxsTimeout) clearTimeout(hideCloneTxsTimeout)
            hideCloneTxsTimeout = null
            return
        }
        // console.log(`Hiding ${clonedTxCircles.length} cloned txs...`)
        for (let circle of clonedTxCircles) {
            circle.visible = false
        }
        clonedTxCircles = []
        hideCloneTxsTimeout = setTimeout(() => {
            hideClonedTxs()
        }, 2000)
    }

    const forwardInjectedTx = function (clonedTx, targetNode, sourceNode) {
        if (clonedTx.circle.currentPosition.x !== sourceNode.currentPosition.x) {
            clonedTx.circle.currentPosition = sourceNode.currentPosition
        }
        if (clonedTx.circle.currentPosition.x === sourceNode.currentPosition.x) {
            const endPoint = distanceBtnTwoNodes(clonedTx, targetNode, true)
            let dur = Math.sqrt(endPoint.x ** 2 + endPoint.y ** 2) * 2
            if (dur < 100) dur = 100
            else dur = dur
            // dur = dur * 1.5
            clonedTx.circle.visible = true
            transformCircle(
                clonedTx.circle,
                // targetNode.currentPosition.x,
                // targetNode.currentPosition.y,
                endPoint.x + sourceNode.currentPosition.x,
                endPoint.y + sourceNode.currentPosition.y,
                null,
                dur
            )
            clonedTxCircles.push(clonedTx.circle)

            // hide tx circle and move it back to starting position for later REUSE
            if (!hideCloneTxsTimeout) {
                hideCloneTxsTimeout = setTimeout(() => {
                    hideClonedTxs()
                }, dur)
            }
        } else {
            console.log('source node and tx circle are not at same place..')
        }
    }

    let n = 0
    let tracker = {}
    let maxN = 0
    let C = 200 / (Math.log(config.idealNodeCount) + 1)
    if (Number.isNaN(C) || C < 150) C = 150

    const calculateNetworkPosition = function (nodeId) {
        // let spread = 12
        let spread = 4
        let angle = 137.508

        let totalNodeCount = Object.keys(G.active).length + Object.keys(G.syncing).length
        let phi = (angle * Math.PI) / 180
        let idRatio = parseInt((nodeId / G.maxId) * totalNodeCount)
        if (tracker[idRatio]) {
            idRatio = maxN + 1
        }
        tracker[idRatio] = true
        if (idRatio > maxN) maxN = idRatio
        n = idRatio
        let r = spread * Math.sqrt(n) + C
        const theta = n * phi
        // console.log('r, theta', r, theta)
        const x = r * Math.cos(theta) + G.X
        const y = r * Math.sin(theta) + G.Y
        n += 1
        return {
            x,
            y,
            degree: angle * n,
        }
    }

    const adjustNodePosition = function () {
        const syncingNodes = Object.values(G.syncing)
        const activeNodes = Object.values(G.active)
        const nodes = syncingNodes.concat(activeNodes)
        const nodeList = nodes.filter((node) => node.degree !== undefined)
        for (let i = 0; i < nodeList.length; i++) {
            nodeList[i].newpos = nodeList[i].despos
        }
        for (let i = 0; i < 20; i++) {
            stepNodePosition(nodeList)
        }
        for (let i = 0; i < nodeList.length; i++) {
            shiftNearestNode(nodeList[i], nodeList[i].newpos)
        }
    }

    const stepNodePosition = function (nodeList) {
        const F_array = []
        const s = 1
        const k = 5

        for (let i = 0; i < nodeList.length; i++) {
            const dArray = []
            let F = 0
            for (let j = 0; j < nodeList.length; j++) {
                if (j == i) {
                    continue
                } // TODO attract to where we want to be
                let d = nodeList[i].newpos - nodeList[j].newpos
                if (d > 180) d = d - 360
                if (d < -180) d = 360 + d
                let sign_d = 1
                if (d < 0) sign_d = -1
                F = F + k * (sign_d / (Math.abs(d) + s))
            }
            F_array[i] = F
        }
        for (let i = 0; i < nodeList.length; i++) {
            nodeList[i].newpos += F_array[i]
            if (nodeList[i].newpos > 360) {
                nodeList[i].newpos -= 360
            }
            if (nodeList[i].newpos < 0) {
                nodeList[i].newpos += 360
            }
        }
    }

    const shiftNearestNode = function (node, newDegree) {
        // new degree instead of delta
        const degree = newDegree
        const radian = (degree * Math.PI) / 180
        const x = G.R * Math.cos(radian) + G.X
        const y = G.R * Math.sin(radian) + G.Y
        const initialX = node.initialPosition.x
        const initialY = node.initialPosition.y
        let travelX
        let travelY
        // let circleStyler = styler(node.circle)
        // let animationStartX = node.currentPosition.x - initialX
        // let animationStartY = node.currentPosition.y - initialY

        travelX = x - node.currentPosition.x
        travelY = y - node.currentPosition.y

        if (travelX === 0 && travelY === 0) {
            return
        }

        if (node.status === 'active') {
            const radius = G.stateCircleRadius
            // move app state circle
            transformCircle(node.rectangel, x, y + radius, null, 500)
            transformCircle(node.markerCycle, x + radius, y - radius, null, 500)
            transformCircle(node.nodeListCycle, x - radius, y - radius, null, 500)
        }

        // move the node
        transformCircle(node.circle, x, y, null, 500)

        node.currentPosition.x = x
        node.currentPosition.y = y
        // node.circle.currentPosition.x = x
        // node.circle.currentPosition.y = y
        node.degree = degree
    }

    const drawNetworkCycle = async function (R, X, Y) {
        const networkHTML = `
        <button id="reset-report">Reset Report</button>
        <a href="chart.html" target="_blank"><button id="chart-button">Charts</button></a>
        <a href="history.html" target="_blank"><button id="history-button">History</button></a>
        <div id="cycle-counter-container"></div>
        <table id="node-info-table">
            <thead>
                <tr>
                    <td>Joining</td>
                    <td>Syncing</td>
                    <td>Active</td>
                    <td>Total</td>
                    <td>Desired</td>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td id="node-info-joining">0</td>
                    <td id="node-info-syncing">0</td>
                    <td id="node-info-active">0</td>
                    <td id="node-info-total">0</td>
                    <td id="node-info-desired">0</td>
                </tr>
            </tbody>
        </table>
        <table id="cycle-info-table">
          <thead>
              <tr>
                <td>Cycle Marker</td>
                <td>Total Processed</td>
                <td>Cycle Counter</td>
              </tr>
          </thead>
          <tbody>
              <tr>
                <td id="current-cyclemarker">-</td>
                <td id="total-processed-txs">-</td>
                <td id="current-cyclecounter">-</td>
              </tr>
          </tbody>
        </table>
        <table id="transaction-table">
          <thead>
              <tr>
                  <td>Max Tps</td>
                  <td>Avg Tps</td>
                  <td>Rejected Txs</td>
                  <td>Expired Txs</td>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td id="current-maxtps">-</td>
                  <td id="current-avgtps">-</td>
                  <td id="total-tx-rejected">-</td>
                  <td id="total-tx-expired">-</td>
              </tr>
          </tbody>
        </table>
        <table id="load-table">
          <thead>
              <tr>
                  <td>Net Load</td>
                  <td>Int Req</td>
                  <td>Ext Req</td>
                  <td>Q Length</td>
                  <td>Q Time</td>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td id="current-load">-</td>
                  <td id="current-internal-node-load">-</td>
                  <td id="current-external-node-load">-</td>
                  <td id="tx-queue-length">-</td>
                  <td id="tx-queue-time">-</td>
              </tr>
          </tbody>
        </table>
        `

        const networkCenter = {
            x: X,
            y: Y,
        }
        drawCircle(networkCenter, G.R, '#ffffff')
        $('#app').innerHTML = networkHTML

        var image = new createjs.Bitmap('logo.png')
        image.set({
            x: G.VW / 2 - G.R * 1.08,
        })
        image.set({
            y: G.VH / 2 - G.R * 1.08,
        })
        const scale = (G.R * 1.94) / 720
        image.set({
            scale: scale,
        })
        stage.addChild(image)
        createjs.Ticker.addEventListener('tick', handleTick)

        function handleTick(event) {
            //stage.update()
        }
    }

    const mode = function (arr) {
        return arr
            .sort((a, b) => arr.filter((v) => v === a).length - arr.filter((v) => v === b).length)
            .pop()
    }

    const checkNodeSyncedState = function (cycleCounter) {
        if (!cycleCounter || !G.partitionMatrix[cycleCounter]) return
        let nodeList = Object.keys(G.partitionMatrix[cycleCounter])
        nodeList = nodeList.sort()
        let syncedObj = {}
        for (let nodeId of nodeList) {
            const partitionReport = G.partitionMatrix[cycleCounter][nodeId].res
            for (let i in partitionReport) {
                const index = partitionReport[i].i
                let hash = partitionReport[i].h
                hash = hash.split('0').join('')
                hash = hash.split('x').join('')
                // collect to syncedObj to decide synced status of nodes later
                if (!syncedObj[index]) {
                    syncedObj[index] = []
                } else {
                    syncedObj[index].push({
                        nodeId,
                        hash,
                    })
                }
            }
            let syncedPenaltyObj = {}
            for (let nodeId of nodeList) {
                syncedPenaltyObj[nodeId] = 0
            }
            for (let index in syncedObj) {
                let hashArr = syncedObj[index].map((obj) => obj.hash)
                let mostCommonHash = mode(hashArr)
                // console.log(`Most common hash in partition ${index}: ${mostCommonHash}`)
                syncedObj[index].forEach((obj) => {
                    // TO TEST
                    // if (Math.random() * 30 > 28) {
                    //   obj.hash = '#wrong'
                    // }
                    if (obj.hash !== mostCommonHash) {
                        syncedPenaltyObj[obj.nodeId] += 1
                    }
                })
            }
            for (let nodeId in syncedPenaltyObj) {
                if (syncedPenaltyObj[nodeId] === 0) {
                    G.nodeSyncState[nodeId] = 0
                } else if (syncedPenaltyObj[nodeId] <= 3) {
                    G.nodeSyncState[nodeId] = 1
                } else if (syncedPenaltyObj[nodeId] > 3) {
                    G.nodeSyncState[nodeId] = 2
                }
            }
        }
    }

    const drawMatrix = function (cycleCounter, startX, startY) {
        if (!cycleCounter) return
        try {
            let nodeList = Object.keys(G.partitionMatrix[cycleCounter])
            nodeList = nodeList.sort()
            const totalNodeCount = Object.keys(G.active).length
            let nodeCount = 0
            let gap = 2
            let width = 5
            let height = 5
            let recList = []
            let background = drawRectangle(
                { x: startX + width * 0.5, y: startY - height },
                (totalNodeCount + 1) * (width + gap),
                (totalNodeCount + 1) * (height + gap),
                0,
                '#ffffff'
            )
            recList.push(background)
            for (let nodeId of nodeList) {
                nodeCount += 1
                const partitionReport = G.partitionMatrix[cycleCounter][nodeId].res
                for (let i in partitionReport) {
                    const index = partitionReport[i].i
                    let hash = partitionReport[i].h
                    hash = hash.split('0').join('')
                    hash = hash.split('x').join('')
                    const position = {
                        x: startX + gap * nodeCount + width * nodeCount,
                        y: startY + height * index + gap * index,
                    }
                    let rec = drawRectangle(position, width, height, 0, `#${hash.substr(0, 6)}cc`)
                    recList.push(rec)
                }
            }
            return recList
        } catch (e) {
            console.warn(e)
        }
    }

    const clearPartitionGraphic = function (cycleCounter) {
        try {
            let recList = G.partitionGraphic[cycleCounter]
            if (recList) {
                recList.forEach((rec) => {
                    rec.graphics.clear()
                })
                //stage.update()
                delete G.partitionGraphic[cycleCounter]
            }
        } catch (e) {
            console.warn(e)
        }
    }
    const clearPartitionButton = function (cycleCounter) {
        try {
            let button = G.partitionButtons[cycleCounter]
            if (button) {
                button.parentNode.removeChild(button)
                delete G.partitionButtons[cycleCounter]
            }
        } catch (e) {
            console.warn(e)
        }
    }

    const clearArrow = function (triangle) {
        if (!triangle) return
        try {
            triangle.graphics.clear()
        } catch (e) {
            console.warn(e)
        }
    }

    const drawCycleCounterButton = function (cycleCounter) {
        // console.log(`Drawing cycle counter for`, cycleCounter)
        if (!cycleCounter) return
        let container = document.querySelector('#cycle-counter-container')
        console.log(container)
        const html = `
      <button>${cycleCounter}</button>
    `
        container.insertAdjacentHTML('beforeend', html)
        let button = document.querySelector('#cycle-counter-container button:last-child')
        button.addEventListener('mouseenter', function (e) {
            let cycleCounter = e.target.innerHTML
            var rect = e.target.getBoundingClientRect()
            let x = rect.left - 10
            let y = rect.bottom + 10
            G.partitionGraphic[cycleCounter] = drawMatrix(cycleCounter, x, y)
        })
        button.addEventListener('mouseleave', function (e) {
            let cycleCounter = e.target.innerHTML
            clearPartitionGraphic(cycleCounter)
        })
        return button
    }

    const getReport = async function () {
        const response = await axios.get(`${G.monitorServerUrl}/report`)
        let activeNodes = response.data.nodes.active
        let cycleCounter
        let shouldDrawButton = false
        for (let nodeId in activeNodes) {
            const partitionReport = activeNodes[nodeId].partitionReport
            cycleCounter = activeNodes[nodeId].cycleCounter
            if (partitionReport && partitionReport.hasOwnProperty('res')) {
                console.log(
                    `partition report for cycle ${cycleCounter}, port ${activeNodes[nodeId].nodeIpInfo.externalPort}`
                )
                if (!G.partitionMatrix[cycleCounter]) {
                    G.partitionMatrix[cycleCounter] = {}
                    G.partitionMatrix[cycleCounter][nodeId] = partitionReport
                } else {
                    G.partitionMatrix[cycleCounter][nodeId] = partitionReport
                }
                shouldDrawButton = true
            }
        }
        if (!G.partitionButtons[cycleCounter] && shouldDrawButton) {
            G.partitionButtons[cycleCounter] = drawCycleCounterButton(cycleCounter)
        }
        let limit = cycleCounter - 5
        for (let counter in G.partitionButtons) {
            if (counter <= limit) {
                clearPartitionButton(counter)
                delete G.partitionMatrix[counter]
            }
        }
        if (Object.keys(G.partitionMatrix).length > 0) {
            const currentCycleCounter = Math.max(...Object.keys(G.partitionMatrix))
            checkNodeSyncedState(currentCycleCounter)
        }

        return response.data
    }

    const checkRemoveStatus = function (nodeId, nodes) {
        try {
            const activeNodeIds = Object.keys(nodes.active)
            if (activeNodeIds.indexOf(nodeId) < 0) {
                console.log(`${nodeId} is removed from the network`)
                return true
            } else return false
        } catch (e) {
            return false
        }
    }

    const flushReport = async function () {
        const response = await axios.get(`${G.monitorServerUrl}/flush`)
        document.location.reload()
    }

    const getRandomPosition = function () {
        const randomAngle = Math.random() * 360
        let maxRadius
        if (G.VW < G.VH) maxRadius = G.VW / 2 - G.nodeRadius
        else maxRadius = G.VH / 2 - G.nodeRadius
        const randomRadius = Math.random() * (maxRadius - G.R) + G.R + 50
        const x = randomRadius * Math.sin(randomAngle)
        const y = randomRadius * Math.cos(randomAngle)
        return {
            x: x + G.X,
            y: y + G.Y,
        }
    }

    const getNearestNodeFromPoint = function (point) {
        const joiningNodes = Object.values(G.joining)
        const sortedNodes = joiningNodes.sort((n1, n2) => {
            return (
                distanceBtnTwoPoints(point, n1.currentPosition) -
                distanceBtnTwoPoints(point, n2.currentPosition)
            )
        })
        return sortedNodes[0]
    }

    const getJoiningPosition = function () {
        let selectedDistance = 0
        let selectedPosition
        const minimumDistance = 2.5 * G.nodeRadius
        if (Object.keys(G.joining).length === 0) return getRandomPosition()

        while (selectedDistance < minimumDistance) {
            const randomPositions = []
            const nearestNodes = []
            const distanceFromNearestNode = []
            for (let i = 0; i < 3; i += 1) randomPositions.push(getRandomPosition())
            for (let i = 0; i < 3; i += 1) {
                nearestNodes.push(getNearestNodeFromPoint(randomPositions[i]))
            }
            for (let i = 0; i < 3; i += 1) {
                distanceFromNearestNode.push({
                    distance: distanceBtnTwoPoints(
                        randomPositions[i],
                        nearestNodes[i].currentPosition
                    ),
                    position: randomPositions[i],
                })
            }
            const sorted = distanceFromNearestNode.sort((d1, d2) => d2.distance - d1.distance)
            selectedDistance = sorted[0].distance
            selectedPosition = sorted[0].position
        }
        return selectedPosition
    }

    const getJoiningNodePosition = function (publicKey) {
        const minimumRadius = G.R + 2.5 * G.nodeRadius
        const angle = (360 * parseInt(publicKey.slice(0, 4), 16)) / G.maxId
        const radiusFactor = parseInt(publicKey.slice(4, 8), 16) / G.maxId
        const radius = radiusFactor * 50 + minimumRadius

        const x = radius * Math.sin((angle * Math.PI) / 180)
        const y = radius * Math.cos((angle * Math.PI) / 180)
        return {
            x: x + G.X,
            y: y + G.Y,
        }
    }

    const makeSVGEl = function (tag, attrs) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag)
        for (var k in attrs) {
            el.setAttribute(k, attrs[k])
        }
        return el
    }
    var stage = new createjs.Stage('demoCanvas')

    stage.canvas.height = G.VH
    stage.canvas.width = G.VW
    init()

    const drawSmallToolTip = function (node) {
        console.log('Drawing small tooltip', node)
        const position = {
            x: node.currentPosition.x - 150 / 2,
            y: node.currentPosition.y - 60,
        }
        let toolTipHeight = 30
        node.smallToolTipRect = drawRectangle(position, 150, toolTipHeight, 5, G.colors.tooltip)
        node.smallTextList = []
        const marginBottom = 22
        const marginLeft = 15

        node.smallTextList.push(
            drawText(
                `${node.externalIp}:${node.externalPort}`,
                {
                    x: position.x + marginLeft,
                    y: position.y + marginBottom,
                },
                13,
                '#ffffff'
            )
        )
    }

    const hideSmallToolTip = function (node) {
        if (node.smallToolTipRect) {
            node.smallToolTipRect.graphics.clear()
            for (let i = 0; i < node.smallTextList.length; i++) {
                node.smallTextList[i].parent.removeChild(node.smallTextList[i])
            }
            //stage.update()
            node.smallTextList = null
            node.smallToolTipRect = null
        }
    }

    const showNodesInfo = function () {
        console.log('Showing node info')
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            drawSmallToolTip(node)
        }
        G.smallToolTipShown = true
    }

    const hideNodesInfo = function () {
        console.log('Hiding node info')
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            hideSmallToolTip(node)
        }
        G.smallToolTipShown = false
    }

    const redirectToLargeNetworkPage = function () {
        location.href = 'large-network.html'
    }

    function KeyPress(e) {
        var evtobj = window.event ? event : e
        if (evtobj.keyCode == 73 && evtobj.ctrlKey) {
            if (G.smallToolTipShown) hideNodesInfo()
            else showNodesInfo()
        }
    }

    document.onkeydown = KeyPress
}

function calculateAverage(load) {
    if (load.length === 0) return 0
    const totalLoad = load.reduce((prev, current) => prev + parseFloat(current), 0)
    return (totalLoad / load.length).toFixed(3)
}

// From https://stackoverflow.com/a/20762713
function mode(list) {
    const arr = [...list]
    return arr
        .sort((a, b) => arr.filter((v) => v === a).length - arr.filter((v) => v === b).length)
        .pop()
}

// $('body').addEventListener('click', (e) => {
//     x=e.clientX;
//     y=e.clientY;
//     cursor="Your Mouse Position Is : " + x + " and " + y ;
//     console.log(cursor)
// })
