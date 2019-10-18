window.$ = function (selector) {
  // shorthand for query selector
  const elements = document.querySelectorAll(selector)
  if (elements.length === 1) return elements[0]
  return elements
}

const {
  tween,
  styler,
  listen,
  pointer,
  timeline,
  easing,
  chain
} = window.popmotion

const NetworkMonitor = function (config) {
  const G = {} // semi-global namespace
  G.nodes = []
  G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
  G.VH = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  )

  G.R = config.networkCircleRadius || 200
  G.X = config.networkCircleX || G.VW / 2
  G.Y = config.networkCircleY || G.VH / 2
  G.nodeRadius = config.nodeRadius || 200
  G.monitorServerUrl =
		config.monitorServerUrl || 'https://tn1.shardus.com:3000/api'
  G.environment = config.environment || 'production'
  G.maxId = parseInt('ffff', 16)
  G.joining = {}
  G.syncing = {}
  G.active = {}
  G.colors = {
    joining: '#999',
    syncing: '#f9cb35',
    active: '#16c716',
    transaction: '#f55555cc',
    tooltip: '#5f5f5fcc'
  }
  G.txAnimationSpeed = 800
  G.stateCircleRadius = G.nodeRadius / 2.5
  G.nodeToForward = 4
  G.generatedTxArray = {}

  let testNodeCount = 0
  const testNodeLimit = 10

  let report = {
    joining: {},
    syncing: {},
    active: {}
  }

  const generateHash = function (num) {
    const table = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'a',
      'b',
      'c',
      'd',
      'e',
      'f'
    ]
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
    report.joining[hash] = {
      nodeIpInfo: {
        internalIp: '127.0.0.1',
        internalPort: '9000',
        externalIp: '123.4.5.6',
        externalPort: '10000'
      }
    }
    setTimeout(() => {
      report.syncing[nodeId] = {
        publicKey: hash,
        nodeIpInfo: {
          internalIp: '127.0.0.1',
          internalPort: '9000',
          externalIp: '123.4.5.6',
          externalPort: '10000'
        }
      }
    }, 2000)
    setTimeout(() => {
      delete report.joining[hash]
    }, 4000)

    setTimeout(() => {
      report.active[nodeId] = {
        appState: generateHash(64),
        nodelistHash: generateHash(64),
        cycleMarker: generateHash(64),
        cycleCounter: Math.random(),
        txInjected: Math.random(),
        txApplied: Math.random(),
        txRejected: Math.random(),
        txExpired: Math.random(),
        desiredNodes: Math.random(),
        reportInterval: 2,
        nodeIpInfo: {
          externalIp: '127.0.0.1',
          externalPort: 3000
        }
      }
    }, 6000)
    setTimeout(() => {
      delete report.syncing[nodeId]
    }, 8000)
  }

  const removeNodeForTesting = function () {
    const activeNodes = Object.keys(report.active)
    let firstNodeId
    if (activeNodes.length > 5) firstNodeId = Object.keys(report.active)[0]
    delete report.active[firstNodeId]
  }

  const init = async function () {
    drawNetworkCycle(G.R, G.X, G.Y)
    $('#reset-report').addEventListener('click', flushReport)
    if (G.environment === 'test') {
      const addNodeInterval = setInterval(() => {
        generateNodeForTesting()
        testNodeCount += 1
        if (testNodeCount > testNodeLimit) clearInterval(addNodeInterval)
      }, 500)
      // let removeNodeInterval = setInterval(() => {
      // 	removeNodeForTesting()
      // }, 6000)
    }

    let totalTxRejected = 0
    let totalTxExpired = 0

    const updateReportInterval = setInterval(async () => {
      if (G.environment === 'production') report = await getReport()
      for (const publicKey in report.nodes.joining) {
        if (!G.joining[publicKey]) {
          // Pass in a list of positions to avoid overlapping grey cicles
          const existingPositions = Object.values(G.joining).map(
            node => node.realPosition
          )
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
              nodeId: nodeId
            })
            delete G.joining[publicKey]
            updateUI('joining', 'syncing', publicKey, nodeId)
            G.syncing[nodeId].tooltipInstance = null
            G.syncing[nodeId].circle.removeAllEventListeners('mouseover')
            G.syncing[nodeId].circle.removeAllEventListeners('mouseout')
            G.syncing[nodeId].tooltipInstance = drawToolipForInactiveNodes(G.syncing[nodeId])
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

      const load = []
      const txQueueLen = []
      const txQueueTime = []
      for (const nodeId in report.nodes.active) {
        if (
          !G.active[nodeId] &&
					nodeId !== null &&
					report.nodes.active[nodeId].appState
        ) {
          if (G.syncing[nodeId]) {
            // active node is already drawn as yellow circle
            // console.log(`Active node found on syncing list...`)
            G.active[nodeId] = Object.assign({}, G.syncing[nodeId], {
              status: 'active',
              nodeId: nodeId
            })
            delete G.syncing[nodeId]
            try {
              G.active[nodeId].appState = report.nodes.active[nodeId].appState
              G.active[nodeId].cycleMarker = report.nodes.active[nodeId].cycleMarker
              G.active[nodeId].cycleCounter = report.nodes.active[nodeId].cycleCounter
              G.active[nodeId].nodelistHash = report.nodes.active[nodeId].nodelistHash
              G.active[nodeId].txInjected = report.nodes.active[nodeId].txInjected
              G.active[nodeId].txApplied = report.nodes.active[nodeId].txApplied
              G.active[nodeId].txRejected = report.nodes.active[nodeId].txRejected
              G.active[nodeId].txExpired = report.nodes.active[nodeId].txExpired
              G.active[nodeId].desiredNodes = report.nodes.active[nodeId].desiredNodes
              G.active[nodeId].reportInterval =
								report.nodes.active[nodeId].reportInterval
              G.active[nodeId].externalIp =
								report.nodes.active[nodeId].nodeIpInfo.externalIp
              G.active[nodeId].externalPort =
								report.nodes.active[nodeId].nodeIpInfo.externalPort
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
              G.active[nodeId].appState = report.nodes.active[nodeId].appState
              G.active[nodeId].cycleMarker = report.nodes.active[nodeId].cycleMarker
              G.active[nodeId].cycleCounter = report.nodes.active[nodeId].cycleCounter
              G.active[nodeId].nodelistHash = report.nodes.active[nodeId].nodelistHash
              G.active[nodeId].txInjected = report.nodes.active[nodeId].txInjected
              G.active[nodeId].txApplied = report.nodes.active[nodeId].txApplied
              G.active[nodeId].txRejected = report.nodes.active[nodeId].txRejected
              G.active[nodeId].txExpired = report.nodes.active[nodeId].txExpired
              G.active[nodeId].desiredNodes = report.nodes.active[nodeId].desiredNodes
              G.active[nodeId].reportInterval =
								report.nodes.active[nodeId].reportInterval
              G.active[nodeId].externalIp =
								report.nodes.active[nodeId].nodeIpInfo.externalIp
              G.active[nodeId].externalPort =
								report.nodes.active[nodeId].nodeIpInfo.externalPort
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
          load.push(report.nodes.active[nodeId].currentLoad.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))
          txQueueLen.push(report.nodes.active[nodeId].queueLength)
          txQueueTime.push(report.nodes.active[nodeId].txTimeInQueue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))

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
          const isRemovedFromNetwork = await checkRemoveStatus(nodeId, report.nodes)
          if (isRemovedFromNetwork) removeNodeFromNetwork(nodeId)
          else {
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
      averageTpsApplied = Math.round(totalTxApplied / activeNodeCount)
      if (!Number.isNaN(averageTpsApplied))
      $('#current-avgtps').innerHTML = report.avgTps
      $('#current-maxtps').innerHTML = report.maxTps
      $('#total-tx-applied').innerHTML = report.totalApplied
      modeDesiredNodes = Math.round(mode(listOfDesiredNodes) || 0)
      $('#total-processed-txs').innerHTML = report.totalProcessed
      if (!Number.isNaN(modeDesiredNodes)) {
        $('#node-info-desired').innerHTML = modeDesiredNodes
      }
      $('#total-tx-rejected').innerHTML = report.totalRejected
      $('#total-tx-expired').innerHTML = report.totalExpired

      if (Object.keys(load).length > 0) {
        const LoadMsg = {
          // time: new Date().toLocaleTimeString('en-US'),
          injected: report.totalInjected,
          rejected: report.totalRejected,
          expired: report.totalExpired,
          applied: report.avgApplied,
          load
        }
        const txQueueLenMsg = {
          injected: report.totalInjected,
          rejected: report.totalRejected,
          expired: report.totalExpired,
          applied: report.avgApplied,
          txQueueLen
        }
        const txQueueTimeMsg = {
          injected: report.totalInjected,
          rejected: report.totalRejected,
          expired: report.totalExpired,
          applied: report.avgApplied,
          txQueueTime
        }
        console.log(JSON.stringify(LoadMsg))
        console.log(JSON.stringify(txQueueLenMsg))
        console.log(JSON.stringify(txQueueTimeMsg))
        console.log('===')
      }

      updateTables()
      injectTransactions()
      updateStateCircle()
      updateMarkerCycle()
      updateNodelistCycle()
    }, 1000)
  }

  const injectTransactions = function () {
    for (const nodeId in G.active) {
      const node = G.active[nodeId]
      const txs = node.txInjected
      const interval = node.reportInterval * 1000
      let animatedInjection = 0

      if (!txs || txs === 0) continue
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
          stage.update()
          injectedTx = null
        }, G.txAnimationSpeed)
        animatedInjection += 1
        if (animatedInjection >= txs) clearInterval(injectInterval)
      }, Math.floor(interval / txs))
    }
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
    node.circle.on('mouseover', () => {
      const position = {
        x: node.currentPosition.x - 150 / 2,
        y: node.currentPosition.y - 150 - 80
      }
      const nodeIdShort = `${node.nodeId.slice(0, 4)}...${node.nodeId.slice(
				59,
				63
			)}`
      const cycleMarkerShort = `${node.cycleMarker.slice(
				0,
				4
			)}...${node.cycleMarker.slice(59, 63)}`
      const appStateShort = `${node.appState.slice(0, 4)}...${node.appState.slice(
				59,
				63
			)}`
      const nodeListShort = `${node.nodelistHash.slice(
				0,
				4
			)}...${node.nodelistHash.slice(59, 63)}`
      node.tooltipRect = drawRectangle(
        position,
        150,
        230,
        5,
        G.colors.tooltip
      )
      node.textList = []
      const marginBottom = 22
      const marginLeft = 15

      node.textList.push(
        drawText(
					`nodeId: ${nodeIdShort}`,
					{
					  x: position.x + marginLeft,
					  y: position.y + marginBottom
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
					  y: position.y + marginBottom * 2
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
					  y: position.y + marginBottom * 3
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
					  y: position.y + marginBottom * 4
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
					  y: position.y + marginBottom * 5
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
					  y: position.y + marginBottom * 6
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
					  y: position.y + marginBottom * 7
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
					  y: position.y + marginBottom * 8
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
					  y: position.y + marginBottom * 9
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
					  y: position.y + marginBottom * 10
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
        stage.update()
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
        y: node.currentPosition.y - 75 - 80
      }
      let nodeIdShort
      if (node.status === 'joining')
        {nodeIdShort = `${node.publicKey.slice(0, 4)}...${node.publicKey.slice(
					59,
					63
				)}`}
      else if (node.status === 'syncing')
        {nodeIdShort = `${node.nodeId.slice(0, 4)}...${node.nodeId.slice(
					59,
					63
				)}`}
      node.tooltipRect = drawRectangle(
        position,
        150,
        120,
        5,
        G.colors.tooltip
      )
      node.textList = []
      const marginBottom = 22
      const marginLeft = 15

      if (node.status === 'joining') {node.textList.push(
				drawText(
					`publicKey: ${nodeIdShort}`,
					{
						x: position.x + marginLeft,
						y: position.y + marginBottom
					},
					13,
					'#ffffff'
				)
			)}
      else {node.textList.push(
				drawText(
					`nodeId: ${nodeIdShort}`,
					{
						x: position.x + marginLeft,
						y: position.y + marginBottom
					},
					13,
					'#ffffff'
				)
			)}
      node.textList.push(
        drawText(
					`ExtIp: ${node.nodeIpInfo.externalIp}`,
					{
					  x: position.x + marginLeft,
					  y: position.y + marginBottom * 2
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
					  y: position.y + marginBottom * 3
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
					  y: position.y + marginBottom * 4
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
					  y: position.y + marginBottom * 5
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
        stage.update()
        node.textList = null
        node.tooltipRect = null
      }
    })
  }

  const updateStateCircle = function () {
    for (const nodeId in G.active) {
      const node = G.active[nodeId]
      if (!node.appState) return

      if (node.rectangel) {
        // update state color
        node.rectangel.myFill.style = `#${node.appState.slice(0, 6)}`
      } else {
        node.rectangel = drawStateCircle(node)
      }
    }
  }

  const updateMarkerCycle = function () {
    for (const nodeId in G.active) {
      const node = G.active[nodeId]
      if (!node.cycleMarker) return

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
      if (!node.nodelistHash) return

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
      const networkPosition = calculateNetworkPosition(
        parseInt(node.nodeId.substr(0, 4), 16)
      )
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
        y: initialY
      }
      node.currentPosition = {
        x: x,
        y: y
      }
      node.degree = networkPosition.degree
      setTimeout(() => {
        adjustNodePosition()
      }, 800)
    }
  }

  const positionNewNodeIntoNetwork = function (currentStatus, node) {
    if (currentStatus === 'syncing' || currentStatus === 'active') {
      node.circle.set('fill', G.colors[currentStatus])
      const networkPosition = calculateNetworkPosition(
        parseInt(node.nodeId.substr(0, 4), 16)
      )
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
        y: initialY
      }
      node.currentPosition = {
        x: x,
        y: y
      }
      node.degree = networkPosition.degree

      if (currentStatus === 'active') {
        node.rectangel = drawStateCircle(node)
        node.markerCycle = drawCycleMarkerBox(node)
        node.nodeListCycle = drawNodeListBox(node)
      }

      setTimeout(() => {
        adjustNodePosition()
      }, 1100)
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
      stage.update()
    }, 1000)
    delete G.active[nodeId]
  }

  const createNewNode = function (
    type,
    id,
    existingPositions = [],
    nodeIpInfo = null
  ) {
    function isTooClose (position, existingPositions) {
      if (existingPositions.length < 1) return false
      for (const existingPosition of existingPositions) {
        if (distanceBtnTwoPoints(position, existingPosition) < 1 * G.nodeRadius)
          {return true}
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
      const networkPosition = calculateNetworkPosition(
        parseInt(id.substr(0, 4), 16)
      )
      // circle = drawCircle(position, G.nodeRadius, G.colors["joining"], 2, id, 1.0);
      circle = drawCircle(
        {
          x: 0,
          y: 0
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
        realPosition: position
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
        realPosition: position
      }
      if (type === 'joining') node.publicKey = id
      if (nodeIpInfo) node.nodeIpInfo = nodeIpInfo
      return node
    }
  }

  const createNewTx = function () {
    return {
      timestamp: Date.now()
    }
  }

  const createNewTxCircle = function (inputTx = null, toNode) {
    const x = G.X + 1.5 * (toNode.currentPosition.x - G.X)
    const y = G.Y + 1.5 * (toNode.currentPosition.y - G.Y)
    const circle = drawCircle(
      {
        x: x,
        y: y
      },
      5,
      G.colors.transaction,
      2
    )
    const currentPosition = circle.currentPosition
    const tx = {
      circle: circle,
      currentPosition,
      data: inputTx
    }
    return tx
  }

  const generatePlainTx = function (node) {
    const x = node.currentPosition.x
    const y = node.currentPosition.y
    const circle = drawCircle(
      {
        x: x,
        y: y
      },
      5,
      G.colors.transaction,
      2
    )
    const currentPosition = {
      x,
      y
    }
    const tx = {
      circle: circle,
      currentPosition,
      data: null
    }
    tx.circle.currentPosition = currentPosition
    tx.circle.visible = false
    return tx
  }

  const cloneTxCircle = function (injectedTx) {
    const circle = drawCircle(
      injectedTx.currentPosition,
      5,
      G.colors.transaction
    )
    // let cloneTx = Object.assign({}, injectedTx)
    // cloneTx.circle = circle
    const cloneTx = {}
    cloneTx.circle = injectedTx.circle.clone()
    cloneTx.circle.currentPosition = injectedTx.currentPosition
    cloneTx.data = injectedTx.data
    cloneTx.currentPosition = injectTransactions.currentPosition
    // console.log(injectedTx)
    // console.log(cloneTx)
    return cloneTx
  }

  const drawStateCircle = function (node) {
    if (!node.appState) return
    const radius = G.stateCircleRadius
    const stateCircle = drawCircle(
      {
        x: node.currentPosition.x,
        y: node.currentPosition.y + radius
      },
      radius,
			`#${node.appState.slice(0, 6)}`,
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
        y: node.currentPosition.y - radius
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
        y: node.currentPosition.y - radius
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

    stage.update()
    return circle
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
    stage.update()
    return rect
  }

  const drawText = function (message, position, fontSize, fontColor) {
    var text = new createjs.Text(message, `${fontSize}px Arial`, fontColor)
    text.x = position.x
    text.y = position.y
    text.textBaseline = 'alphabetic'
    stage.addChild(text)
    stage.update()
    return text
  }
  /*
	x = x cordinate of target position
	y = y cordinate of target position
	circle = cirlce to transform
	*/
  function transformCircle (circle, x, y, fill, duration) {
    const travelX = x - circle.currentPosition.x
    const travelY = y - circle.currentPosition.y

    if (fill) {
      setTimeout(() => {
        circle.myFill.style = fill
      }, duration / 2)
    }
    createjs.Tween.get(circle, {
      loop: false
    }).to(
      {
        x: travelX,
        y: travelY
      },
      duration,
      createjs.Ease.linear
    )
    createjs.Ticker.framerate = 60
    createjs.Ticker.addEventListener('tick', stage)
    // TweenLite.ticker.addEventListener("tick", stage.update, stage);
    // stage.update();
    // TweenLite.to(circle, duration / 1000, {x: travelX, y: travelY, easel:{tint:0x00FF00}, ease: Power0.easeNone});
  }

  function animateFadeIn (circle, duration, wait) {
    createjs.Tween.get(circle, {
      loop: false
    })
      .wait(wait)
      .to(
        {
          alpha: 1.0
        },
        duration,
        createjs.Ease.linear
      )
    createjs.Ticker.framerate = 60
    createjs.Ticker.addEventListener('tick', stage)
  }

  function growAndShrink (rec, position) {
    rec.scaleX = 0.5
    rec.scaleY = 0.5
    rec.x = position.x
    rec.y = position.y
    rec.regX = rec.radius / 4
    rec.regY = rec.radius / 4
    let duration = Math.random() * 800
    duration = duration < 400 ? 400 : duration

    createjs.Tween.get(rec, {
      loop: false
    })
      .to(
        {
          scale: 1.4,
          alpha: 0.5
        },
        duration,
        createjs.Ease.linear
      )
      .to(
        {
          scale: 1.0,
          alpha: 1.0
        },
        duration,
        createjs.Ease.linear
      )

    createjs.Ticker.framerate = 60
    createjs.Ticker.addEventListener('tick', stage)
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

    if (substract)
      {return {
				x: xDiff - xFactor * Math.sqrt(x * x),
				y: yDiff - yFactor * Math.sqrt(y * y)
			}}
    return {
      x: xDiff,
      y: yDiff
    }

    if (substract)
      {return {
				x: node2.currentPosition.x - xFactor * Math.sqrt(x * x),
				y: node2.currentPosition.y - yFactor * Math.sqrt(y * y)
			}}
    return {
      x: xDiff,
      y: yDiff
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
    if (excludedNode)
      {nodeList = nodeList.filter(n => n.nodeId !== excludedNode.nodeId)}
    if (nodeList.length === 0) return []
    if (nodeList.length < count) n = nodeList.length
    else n = count
    for (let i = 0; i < n; i += 1) {
      const item = nodeList[Math.floor(Math.random() * nodeList.length)]
      randomNodes.push(item)
      nodeList = nodeList.filter(n => n.nodeId !== excludedNode.nodeId)
    }
    return randomNodes
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

      // hide tx circle and move it back to starting position for later REUSE
      setTimeout(() => {
        clonedTx.circle.visible = false
        // transformCircle(
        // 	clonedTx.circle,
        // 	sourceNode.currentPosition.x,
        // 	sourceNode.currentPosition.y,
        // 	null,
        // 	20
        // )
      }, dur)
    } else {
      console.log('source node and tx circle are not at same place..')
    }
  }

  const calculateNetworkPosition = function (nodeId) {
    const degree = 360 - (nodeId / G.maxId) * 360
    const radian = (degree * Math.PI) / 180
    const x = G.R * Math.cos(radian) + G.X
    const y = G.R * Math.sin(radian) + G.Y
    return {
      x,
      y,
      degree
    }
  }

  const adjustNodePosition = function () {
    const syncingNodes = Object.values(G.syncing)
    const activeNodes = Object.values(G.active)
    const nodes = syncingNodes.concat(activeNodes)
    const nodeList = nodes.filter(node => node.degree !== undefined)
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
                  <td>Total Applied</td>
                  <td>Rejected Txs</td>
                  <td>Expired Txs</td>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td id="current-maxtps">-</td>
                  <td id="current-avgtps">-</td>
                  <td id="total-tx-applied">-</td>
                  <td id="total-tx-rejected">-</td>
                  <td id="total-tx-expired">-</td>
              </tr>
          </tbody>
        </table>
        `

    const networkCenter = {
      x: X,
      y: Y
    }
    drawCircle(networkCenter, G.R, '#ffffff')
    $('#app').innerHTML = networkHTML

    var image = new createjs.Bitmap('earth.png')
    image.set({
      x: G.VW / 2 - G.R
    })
    image.set({
      y: G.VH / 2 - G.R
    })
    const scale = (G.R * 2) / 720
    image.set({
      scale: scale
    })
    stage.addChild(image)
    createjs.Ticker.addEventListener('tick', handleTick)

    function handleTick (event) {
      stage.update()
    }
  }

  const getReport = async function () {
    const response = await axios.get(`${G.monitorServerUrl}/report`)
    return response.data
  }

  const checkRemoveStatus = async function (nodeId, report) {
    const activeNodeIds = Object.keys(report.active)
    if (activeNodeIds.indexOf(nodeId) < 0) {
      console.log(`${nodeId} is removed from the network`)
      return true
    } else return false
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
      y: y + G.Y
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
      for (let i = 0; i < 3; i += 1)
        {nearestNodes.push(getNearestNodeFromPoint(randomPositions[i]))}
      for (let i = 0; i < 3; i += 1) {
        distanceFromNearestNode.push({
          distance: distanceBtnTwoPoints(
            randomPositions[i],
            nearestNodes[i].currentPosition
          ),
          position: randomPositions[i]
        })
      }
      const sorted = distanceFromNearestNode.sort(
        (d1, d2) => d2.distance - d1.distance
      )
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
      y: y + G.Y
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
}

// From https://stackoverflow.com/a/20762713
function mode (list) {
  const arr = [...list]
  return arr
    .sort(
      (a, b) =>
        arr.filter(v => v === a).length - arr.filter(v => v === b).length
    )
    .pop()
}

// $('body').addEventListener('click', (e) => {
//     x=e.clientX;
//     y=e.clientY;
//     cursor="Your Mouse Position Is : " + x + " and " + y ;
//     console.log(cursor)
// })
