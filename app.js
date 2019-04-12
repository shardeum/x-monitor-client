window.$ = function (selector) {
	// shorthand for query selector
	let elements = document.querySelectorAll(selector)
	if (elements.length === 1) return elements[0]
	return elements
}

let {
	tween,
	styler,
	listen,
	pointer,
	timeline,
	easing,
	chain
} = window.popmotion

let NetworkMonitor = function (config) {
	let G = {} // semi-global namespace
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
		config.monitorServerUrl || `https://tn1.shardus.com:3000/api`
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
		tooltip: '#5f5f5fcc'
	}
	G.txAnimationSpeed = 800
	G.stateCircleRadius = G.nodeRadius / 2.5
	G.nodeToForward = 4
	G.generatedTxArray = {}

	let testNodeCount = 0
	let testNodeLimit = 49

	let report = {
		joining: {},
		syncing: {},
		active: {}
	}

	const generateHash = function (num) {
		let table = [
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
			let randomIndex = Math.floor(Math.random() * table.length)
			hash += table[randomIndex]
		}
		return hash
	}

	const generateNodeForTesting = function () {
		let hash = generateHash(64)
		report.joining[hash] = true
		setTimeout(() => {
			report.syncing[hash] = hash
		}, 1000)
		setTimeout(() => {
			delete report.joining[hash]
		}, 2000)

		setTimeout(() => {
			report.active[hash] = {
				appState: generateHash(64),
				nodelistHash: generateHash(64),
				cycleMarker: generateHash(64),
				txInjected: Math.random(),
				txApplied: Math.random(),
				desiredNodes: Math.random(),
				reportInterval: 2,
				nodeIpInfo: {
					externalIp: '127.0.0.1',
					externalPort: 3000
				}
			}
		}, 3000)
		setTimeout(() => {
			delete report.syncing[hash]
		}, 4000)
	}

	const removeNodeForTesting = function () {
		let activeNodes = Object.keys(report.active)
		let firstNodeId
		if (activeNodes.length > 5) firstNodeId = Object.keys(report.active)[0]
		delete report.active[firstNodeId]
	}

	const init = async function () {
		drawNetworkCycle(G.R, G.X, G.Y)
		$('#reset-report').addEventListener('click', flushReport)
		if (G.environment === 'test') {
			let addNodeInterval = setInterval(() => {
				generateNodeForTesting()
				testNodeCount += 1
				if (testNodeCount > testNodeLimit) clearInterval(addNodeInterval)
			}, 500)
			// let removeNodeInterval = setInterval(() => {
			// 	removeNodeForTesting()
			// }, 6000)
		}

		let updateReportInterval = setInterval(async () => {
			if (G.environment === 'production') report = await getReport()
			for (let publicKey in report.joining) {
				if (!G.joining[publicKey]) {
					G.joining[publicKey] = createNewNode('joining', publicKey)
				}
			}

			for (let nodeId in report.syncing) {
				let publicKey = report.syncing[nodeId]
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
					} else {
						// syncing node is not drawn as gray circle yet
						// console.log(`New syncing node`)
						G.syncing[nodeId] = createNewNode('syncing', nodeId)
						G.syncing[nodeId].nodeId = nodeId
						positionNewNodeIntoNetwork('syncing', G.syncing[nodeId])
					}
				}
			}

			for (let nodeId in report.active) {
				if (
					!G.active[nodeId] &&
					nodeId !== null &&
					report.active[nodeId].appState
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
							G.active[nodeId].appState = report.active[nodeId].appState
							G.active[nodeId].cycleMarker = report.active[nodeId].cycleMarker
							G.active[nodeId].nodelistHash = report.active[nodeId].nodelistHash
							G.active[nodeId].txInjected = report.active[nodeId].txInjected
							G.active[nodeId].txApplied = report.active[nodeId].txApplied
							G.active[nodeId].desiredNodes = report.active[nodeId].desiredNodes
							G.active[nodeId].reportInterval =
								report.active[nodeId].reportInterval
							G.active[nodeId].externalIp =
								report.active[nodeId].nodeIpInfo.externalIp
							G.active[nodeId].externalPort =
								report.active[nodeId].nodeIpInfo.externalPort
						} catch (e) {
							console.log(e)
						}
						updateUI('syncing', 'active', null, nodeId)
						G.active[nodeId].tooltipInstance = drawTooltip(G.active[nodeId])
					} else {
						// syncing node is not drawn as gray circle yet
						console.log(`New active node`)
						G.active[nodeId] = createNewNode('active', nodeId)
						G.active[nodeId].nodeId = nodeId
						try {
							G.active[nodeId].appState = report.active[nodeId].appState
							G.active[nodeId].cycleMarker = report.active[nodeId].cycleMarker
							G.active[nodeId].nodelistHash = report.active[nodeId].nodelistHash
							G.active[nodeId].txInjected = report.active[nodeId].txInjected
							G.active[nodeId].txApplied = report.active[nodeId].txApplied
							G.active[nodeId].desiredNodes = report.active[nodeId].desiredNodes
							G.active[nodeId].reportInterval =
								report.active[nodeId].reportInterval
							G.active[nodeId].externalIp =
								report.active[nodeId].nodeIpInfo.externalIp
							G.active[nodeId].externalPort =
								report.active[nodeId].nodeIpInfo.externalPort
						} catch (e) {
							console.log(e)
						}
						await positionNewNodeIntoNetwork('active', G.active[nodeId])
						G.active[nodeId].tooltipInstance = drawTooltip(G.active[nodeId])
					}
				} else if (G.active[nodeId] && report.active[nodeId].appState) {
					G.active[nodeId].appState = report.active[nodeId].appState
					G.active[nodeId].cycleMarker = report.active[nodeId].cycleMarker
					G.active[nodeId].nodelistHash = report.active[nodeId].nodelistHash
					G.active[nodeId].txInjected = report.active[nodeId].txInjected
					G.active[nodeId].txApplied = report.active[nodeId].txApplied
					G.active[nodeId].desiredNodes = report.active[nodeId].desiredNodes
					G.active[nodeId].reportInterval = report.active[nodeId].reportInterval
					G.active[nodeId].externalIp =
						report.active[nodeId].nodeIpInfo.externalIp
					G.active[nodeId].externalPort =
						report.active[nodeId].nodeIpInfo.externalPort
				}
			}
			let totalTxCircle = 0
			for (let nodeId in G.active) {
				if (!G.generatedTxArray[nodeId]) {
					G.generatedTxArray[nodeId] = []
					for (let i = 0; i < G.nodeToForward; i++) {
						let plainTx = generatePlainTx(G.active[nodeId])
						G.generatedTxArray[nodeId].push(plainTx)
						totalTxCircle += 1
					}
				}
			}
			let totalTxApplied = 0
			let totalDesiredNodes = 0
			let averageTpsApplied = 0
			let averageDesiredNodes = 0
			let activeNodeCount = 0
			for (let nodeId in G.active) {
				if (nodeId !== null) {
					const isRemovedFromNetwork = await checkRemoveStatus(nodeId, report)
					if (isRemovedFromNetwork) removeNodeFromNetwork(nodeId)
					else {
						const txApplied = G.active[nodeId].txApplied
						const desiredNodes = G.active[nodeId].desiredNodes
						totalTxApplied += txApplied
						totalDesiredNodes += desiredNodes
						activeNodeCount += 1
					}
				}
			}
			averageTpsApplied = Math.round(totalTxApplied / activeNodeCount)
			if (!Number.isNaN(averageTpsApplied)) $("#current-averagetps").innerHTML = averageTpsApplied
			averageDesiredNodes = Math.round(totalDesiredNodes / activeNodeCount)
			if (!Number.isNaN(averageDesiredNodes)) $("#node-info-desired").innerHTML = averageDesiredNodes
			updateTables()
			injectTransactions()
			updateStateCircle()
			updateMarkerCycle()
			updateNodelistCycle()
		}, 2000)
	}

	const injectTransactions = function () {
		for (let nodeId in G.active) {
			let node = G.active[nodeId]
			let txs = node.txInjected
			let interval = node.reportInterval * 1000
			let animatedInjection = 0

			if (!txs || txs === 0) continue
			let injectInterval = setInterval(() => {
				let newTx = createNewTx()
				let injectedTx = createNewTxCircle(newTx, node)
				let travelDistance = distanceBtnTwoNodes(injectedTx, node, false)
				transformCircle(
					injectedTx.circle,
					node.currentPosition.x,
					node.currentPosition.y,
					null,
					G.txAnimationSpeed
				)
				setTimeout(() => {
					injectedTx.currentPosition = node.currentPosition
					let randomNodes = getRandomActiveNodes(G.nodeToForward, node)
					for (let i = 0; i < randomNodes.length; i += 1) {
						let clonedTx = G.generatedTxArray[nodeId][i]
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
			let node = G.active[nodeId]
			node.rectangel = drawStateCircle(node)
			node.markerCycle = drawCycleMarkerBox(node)
			node.nodeListCycle = drawNodeListBox(node)
			node.circle.myFill.style = G.colors['active']
		}
	}

	const updateTables = function () {
		let totalJoining = Object.keys(G.joining).length
		let totalSyncing = Object.keys(G.syncing).length
		let totalActive = Object.keys(G.active).length
		let total = totalJoining + totalSyncing + totalActive

		$('#node-info-joining').innerHTML = totalJoining
		$('#node-info-syncing').innerHTML = totalSyncing
		$('#node-info-active').innerHTML = totalActive
		$('#node-info-total').innerHTML = total

		if (Object.keys(G.active).length > 0) {
			let currentCycleMarker = G.active[Object.keys(G.active)[0]].cycleMarker
			$('#current-cyclemarker').innerHTML = `${currentCycleMarker.slice(
				0,
				4
			)}...${currentCycleMarker.slice(59, 63)}`
		}
	}

	const drawTooltip = function (node) {
		stage.enableMouseOver(20)
		node.circle.on('mouseover', () => {
			let position = {
				x: node.currentPosition.x - 150 / 2,
				y: node.currentPosition.y - 150 - 30
			}
			let nodeIdShort = `${node.nodeId.slice(0, 4)}...${node.nodeId.slice(
				59,
				63
			)}`
			let cycleMarkerShort = `${node.cycleMarker.slice(
				0,
				4
			)}...${node.cycleMarker.slice(59, 63)}`
			let appStateShort = `${node.appState.slice(0, 4)}...${node.appState.slice(
				59,
				63
			)}`
			let nodeListShort = `${node.nodelistHash.slice(
				0,
				4
			)}...${node.nodelistHash.slice(59, 63)}`
			node.tooltipRect = drawRectangle(
				position,
				150,
				190,
				5,
				G.colors['tooltip']
			)
			node.textList = []
			let marginBottom = 22
			let marginLeft = 15

			node.textList.push(
				drawText(
					`nodeId: ${nodeIdShort}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`marker: ${cycleMarkerShort}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 2
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`state: ${appStateShort}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 3
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`nodeList: ${nodeListShort}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 4
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`ExtIp: ${node.externalIp}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 5
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`ExtPort: ${node.externalPort}`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 6
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`TxInjected: ${node.txInjected.toFixed(1)} tx/s`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 7
					},
					13,
					'#ffffff'
				)
			)
			node.textList.push(
				drawText(
					`TxApplied: ${node.txApplied.toFixed(1)} tx/s`, {
						x: position.x + marginLeft,
						y: position.y + marginBottom * 8
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
		for (let nodeId in G.active) {
			let node = G.active[nodeId]
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
		for (let nodeId in G.active) {
			let node = G.active[nodeId]
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
		for (let nodeId in G.active) {
			let node = G.active[nodeId]
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
			let networkPosition = calculateNetworkPosition(
				parseInt(node.nodeId.substr(0, 4), 16)
			)
			node.despos = networkPosition.degree // set the desired position of the node
			let x = networkPosition.x
			let y = networkPosition.y
			let initialX = node.currentPosition.x
			let initialY = node.currentPosition.y
			let travelX
			let travelY

			travelX = x - initialX
			travelY = y - initialY

			let circle = node.circle
			transformCircle(circle, x, y, G.colors['syncing'], 800)

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
			let networkPosition = calculateNetworkPosition(
				parseInt(node.nodeId.substr(0, 4), 16)
			)
			node.despos = networkPosition.degree // set the desired position of the node
			let x = networkPosition.x
			let y = networkPosition.y
			let initialX = node.circle.x
			let initialY = node.circle.y
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
		let node = G.active[nodeId]
		let x = G.X + 3.5 * (node.currentPosition.x - G.X)
		let y = G.Y + 3.5 * (node.currentPosition.y - G.Y)
		let initialX = node.initialPosition.x
		let initialY = node.initialPosition.y
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
			let radius = G.stateCircleRadius
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

	const createNewNode = function (type, id) {
		const position = getJoiningNodePosition(id)
		let circle
		if (type === 'joining') {
			let networkPosition = calculateNetworkPosition(
				parseInt(id.substr(0, 4), 16)
			)
			// circle = drawCircle(position, G.nodeRadius, G.colors["joining"], 2, id, 1.0);
			circle = drawCircle({
					x: 0,
					y: 0
				},
				G.nodeRadius,
				G.colors['joining'],
				2,
				id,
				0.1
			)
			let node = {
				circle: circle,
				status: type,
				currentPosition: circle
			}
			growAndShrink(circle, position)
			if (type === 'joining') node.publicKey = id
			return node
		} else {
			let circle = drawCircle(position, G.nodeRadius, G.colors[type], 2, id)
			let node = {
				circle: circle,
				status: type,
				currentPosition: circle
			}
			if (type === 'joining') node.publicKey = id
			return node
		}
	}

	const createNewTx = function () {
		return {
			timestamp: Date.now()
		}
	}

	const createNewTxCircle = function (inputTx = null, toNode) {
		let x = G.X + 1.5 * (toNode.currentPosition.x - G.X)
		let y = G.Y + 1.5 * (toNode.currentPosition.y - G.Y)
		let circle = drawCircle({
				x: x,
				y: y
			},
			5,
			G.colors['transaction'],
			2
		)
		let currentPosition = circle.currentPosition
		let tx = {
			circle: circle,
			currentPosition,
			data: inputTx
		}
		return tx
	}

	const generatePlainTx = function (node) {
		let x = node.currentPosition.x
		let y = node.currentPosition.y
		let circle = drawCircle({
				x: x,
				y: y
			},
			5,
			G.colors['transaction'],
			2
		)
		let currentPosition = {
			x,
			y
		}
		let tx = {
			circle: circle,
			currentPosition,
			data: null
		}
		tx.circle.currentPosition = currentPosition
		tx.circle.visible = false
		return tx
	}

	const cloneTxCircle = function (injectedTx) {
		let circle = drawCircle(
			injectedTx.currentPosition,
			5,
			G.colors['transaction']
		)
		// let cloneTx = Object.assign({}, injectedTx)
		// cloneTx.circle = circle
		let cloneTx = {}
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
		let radius = G.stateCircleRadius
		let stateCircle = drawCircle({
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

		let radius = G.stateCircleRadius
		let x = 2 * radius * Math.cos(Math.PI / 4)
		let y = 2 * radius * Math.sin(Math.PI / 4)

		let cycleMarkerCircle = drawCircle({
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

		let radius = G.stateCircleRadius
		let x = 2 * radius * Math.cos(Math.PI / 4)
		let y = 2 * radius * Math.sin(Math.PI / 4)

		let nodeListCircle = drawCircle({
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
	function transformCircle(circle, x, y, fill, duration) {
		let travelX = x - circle.currentPosition.x
		let travelY = y - circle.currentPosition.y

		if (fill) {
			setTimeout(() => {
				circle.myFill.style = fill
			}, duration / 2)
		}
		createjs.Tween.get(circle, {
			loop: false
		}).to({
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

	function animateFadeIn(circle, duration, wait) {
		createjs.Tween.get(circle, {
				loop: false
			})
			.wait(wait)
			.to({
					alpha: 1.0
				},
				duration,
				createjs.Ease.linear
			)
		createjs.Ticker.framerate = 60
		createjs.Ticker.addEventListener('tick', stage)
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
				loop: false
			})
			.to({
					scale: 1.4,
					alpha: 0.5
				},
				duration,
				createjs.Ease.linear
			)
			.to({
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
		let xDiff = node2.currentPosition.x - node1.currentPosition.x
		let yDiff = node2.currentPosition.y - node1.currentPosition.y
		let R = G.nodeRadius
		let radian = Math.atan(yDiff / xDiff)
		let x = R * Math.cos(radian)
		let y = R * Math.sin(radian)

		let xFactor = 1
		let yFactor = 1

		if (xDiff < 0) xFactor = -1
		if (yDiff < 0) yFactor = -1

		if (substract)
			return {
				x: xDiff - xFactor * Math.sqrt(x * x),
				y: yDiff - yFactor * Math.sqrt(y * y)
			}
		return {
			x: xDiff,
			y: yDiff
		}

		if (substract)
			return {
				x: node2.currentPosition.x - xFactor * Math.sqrt(x * x),
				y: node2.currentPosition.y - yFactor * Math.sqrt(y * y)
			}
		return {
			x: xDiff,
			y: yDiff
		}
	}
	const distanceBtnTwoPoints = function (p1, p2) {
		let dx = p1.x - p2.x
		let dy = p1.y - p2.y
		let distance = Math.sqrt(dx ** 2 + dy ** 2)
		return distance
	}

	const getRandomActiveNodes = function (count, excludedNode = null) {
		let nodeList = []
		for (let nodeId in G.active) {
			nodeList.push(G.active[nodeId])
		}
		let randomNodes = []
		let n
		if (excludedNode)
			nodeList = nodeList.filter(n => n.nodeId !== excludedNode.nodeId)
		if (nodeList.length === 0) return []
		if (nodeList.length < count) n = nodeList.length
		else n = count
		for (let i = 0; i < n; i += 1) {
			let item = nodeList[Math.floor(Math.random() * nodeList.length)]
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
			let endPoint = distanceBtnTwoNodes(clonedTx, targetNode, true)
			let dur = Math.sqrt(endPoint.x ** 2 + endPoint.y ** 2)
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
		let degree = 360 - (nodeId / G.maxId) * 360
		let radian = (degree * Math.PI) / 180
		let x = G.R * Math.cos(radian) + G.X
		let y = G.R * Math.sin(radian) + G.Y
		return {
			x,
			y,
			degree
		}
	}

	const adjustNodePosition = function () {
		let syncingNodes = Object.values(G.syncing)
		let activeNodes = Object.values(G.active)
		let nodes = syncingNodes.concat(activeNodes)
		let nodeList = nodes.filter(node => node.degree !== undefined)
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
		let F_array = []
		let s = 1
		let k = 5

		for (let i = 0; i < nodeList.length; i++) {
			let dArray = []
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
		let degree = newDegree
		let radian = (degree * Math.PI) / 180
		let x = G.R * Math.cos(radian) + G.X
		let y = G.R * Math.sin(radian) + G.Y
		let initialX = node.initialPosition.x
		let initialY = node.initialPosition.y
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
			let radius = G.stateCircleRadius
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
		let networkHTML = `
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
        <table id="cyclemarker-table">
            <thead>
                <tr>
                    <td>Cycle Marker</td>
                    <td>Average TPS</td>
                </tr>
            </thead>
            <tbody>
                <tr>
					<td id="current-cyclemarker">-</td>
					<td id="current-averagetps">-</td>
                </tr>
            </tbody>
        </table>
        `

		let networkCenter = {
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
		let scale = (G.R * 2) / 720
		image.set({
			scale: scale
		})
		stage.addChild(image)
		createjs.Ticker.addEventListener('tick', handleTick)

		function handleTick(event) {
			stage.update()
		}
	}

	const getReport = async function () {
		let response = await axios.get(`${G.monitorServerUrl}/report`)
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
		let response = await axios.get(`${G.monitorServerUrl}/flush`)
		document.location.reload()
	}

	const getRandomPosition = function () {
		let randomAngle = Math.random() * 360
		let maxRadius
		if (G.VW < G.VH) maxRadius = G.VW / 2 - G.nodeRadius
		else maxRadius = G.VH / 2 - G.nodeRadius
		let randomRadius = Math.random() * (maxRadius - G.R) + G.R + 50
		let x = randomRadius * Math.sin(randomAngle)
		let y = randomRadius * Math.cos(randomAngle)
		return {
			x: x + G.X,
			y: y + G.Y
		}
	}

	const getNearestNodeFromPoint = function (point) {
		let joiningNodes = Object.values(G.joining)
		let sortedNodes = joiningNodes.sort((n1, n2) => {
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
		let minimumDistance = 2.5 * G.nodeRadius
		if (Object.keys(G.joining).length === 0) return getRandomPosition()

		while (selectedDistance < minimumDistance) {
			let randomPositions = []
			let nearestNodes = []
			let distanceFromNearestNode = []
			for (let i = 0; i < 3; i += 1) randomPositions.push(getRandomPosition())
			for (let i = 0; i < 3; i += 1)
				nearestNodes.push(getNearestNodeFromPoint(randomPositions[i]))
			for (let i = 0; i < 3; i += 1) {
				distanceFromNearestNode.push({
					distance: distanceBtnTwoPoints(
						randomPositions[i],
						nearestNodes[i].currentPosition
					),
					position: randomPositions[i]
				})
			}
			let sorted = distanceFromNearestNode.sort(
				(d1, d2) => d2.distance - d1.distance
			)
			selectedDistance = sorted[0].distance
			selectedPosition = sorted[0].position
		}
		return selectedPosition
	}

	const getJoiningNodePosition = function (publicKey) {
		let minimumRadius = G.R + 2.5 * G.nodeRadius
		let angle = (360 * parseInt(publicKey.slice(0, 4), 16)) / G.maxId
		let radiusFactor = parseInt(publicKey.slice(4, 8), 16) / G.maxId
		let radius = radiusFactor * 50 + minimumRadius

		let x = radius * Math.sin((angle * Math.PI) / 180)
		let y = radius * Math.cos((angle * Math.PI) / 180)
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

// $('body').addEventListener('click', (e) => {
//     x=e.clientX;
//     y=e.clientY;
//     cursor="Your Mouse Position Is : " + x + " and " + y ;
//     console.log(cursor)
// })
