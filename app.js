window.$ = function(selector) { // shorthand for query selector
    let elements = document.querySelectorAll(selector)
    if (elements.length === 1) return elements[0]
    return elements
}

let { tween, styler, listen, pointer, timeline, easing } = window.popmotion

let NetworkMonitor = function(config) {
    let G = {} // semi-global namespace
    G.nodes = []
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    G.VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
    G.R = config.networkCircleRadius || 200
    G.X = config.networkCircleX || G.VW / 2
    G.Y = config.networkCircleY || G.VH / 2
    G.nodeRadius = config.nodeRadius || 200
    G.monitorServerUrl = config.monitorServerUrl || `https://tn1.shardus.com:3000/api`
    G.maxId = parseInt('ffff', 16)
    G.joining = {}
    G.syncing = {}
    G.active = {}
    G.colors = {
        'joining': '#999',
        'syncing': '#f9cb35',
        'active': '#16c716',
        'transaction': '#f55555cc'
    }
    G.txAnimationSpeed = 800
    G.stateCircleRadius = G.nodeRadius / 2.5

    const init = async function () {
        drawNetworkCycle(G.R, G.X, G.Y)
        $('#reset-report').addEventListener('click', flushReport)
        
        let updateReportInterval = setInterval(async () => {
            let report = await getReport()

            for(let publicKey in report.joining) {
                if (!G.joining[publicKey]) {
                    G.joining[publicKey] = createNewNode('joining', publicKey)
                }
            }

            for(let nodeId in report.syncing) {
                let publicKey = report.syncing[nodeId]
                if (!G.syncing[nodeId] && nodeId !== null && nodeId !== 'null') {
                    if (G.joining[publicKey]) { // syncing node is already drawn as gray circle
                        console.log(`Syncing node found on joining list...`)
                        G.syncing[nodeId] = Object.assign({}, G.joining[publicKey], {status: 'syncing', nodeId: nodeId})
                        delete G.joining[publicKey]
                        updateUI('joining', 'syncing', publicKey, nodeId)
                    } else { // syncing node is not drawn as gray circle yet
                        console.log(`New syncing node`)
                        G.syncing[nodeId] = createNewNode('syncing', nodeId)
                        G.syncing[nodeId].nodeId = nodeId
                        positionNewNodeIntoNetwork('syncing', G.syncing[nodeId])
                    }
                }
            }

            for(let nodeId in report.active) {
                if (!G.active[nodeId] && nodeId !== null && report.active[nodeId].appState) {
                    if (G.syncing[nodeId]) { // active node is already drawn as yellow circle
                        console.log(`Active node found on syncing list...`)
                        G.active[nodeId] = Object.assign({}, G.syncing[nodeId], {status: 'active', nodeId: nodeId })
                        delete G.syncing[nodeId]
                        try {
                            G.active[nodeId].appState = report.active[nodeId].appState
                            G.active[nodeId].cycleMarker = report.active[nodeId].cycleMarker
                            G.active[nodeId].nodelistHash = report.active[nodeId].nodelistHash
                            G.active[nodeId].txInjected = report.active[nodeId].txInjected
                            G.active[nodeId].txApplied = report.active[nodeId].txApplied
                            G.active[nodeId].reportInterval = report.active[nodeId].reportInterval
                            G.active[nodeId].externalIp = report.active[nodeId].nodeIpInfo.externalIp
                            G.active[nodeId].externalPort = report.active[nodeId].nodeIpInfo.externalPort
                        } catch(e) {
                            console.log(e)
                        }
                        updateUI('syncing', 'active', null, nodeId)
                        G.active[nodeId].tooltipInstance = drawTooltip(G.active[nodeId])
                    } else { // syncing node is not drawn as gray circle yet
                        console.log(`New active node`)
                        G.active[nodeId] = createNewNode('active', nodeId)
                        G.active[nodeId].nodeId = nodeId
                        try {
                            G.active[nodeId].appState = report.active[nodeId].appState
                            G.active[nodeId].cycleMarker = report.active[nodeId].cycleMarker
                            G.active[nodeId].nodelistHash = report.active[nodeId].nodelistHash
                            G.active[nodeId].txInjected = report.active[nodeId].txInjected
                            G.active[nodeId].txApplied = report.active[nodeId].txApplied
                            G.active[nodeId].reportInterval = report.active[nodeId].reportInterval
                            G.active[nodeId].externalIp = report.active[nodeId].nodeIpInfo.externalIp
                            G.active[nodeId].externalPort = report.active[nodeId].nodeIpInfo.externalPort
                        } catch(e) {
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
                    G.active[nodeId].reportInterval = report.active[nodeId].reportInterval
                    G.active[nodeId].externalIp = report.active[nodeId].nodeIpInfo.externalIp
                    G.active[nodeId].externalPort = report.active[nodeId].nodeIpInfo.externalPort
                    updateTooltip(G.active[nodeId])
                }
            }
            updateTables()
            injectTransactions()
            updateStateCircle()
            updateMarkerCycle()
            updateNodelistCycle()
        }, 2000)
    }

    const injectTransactions = function() {
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            let txs = node.txInjected
            let interval = node.reportInterval * 1000
            let animatedInjection = 0

            if (!txs || txs === 0) continue
            let injectInterval = setInterval(() => {
                let newTx = createNewTx()
                let injectedTx = createNewTxCircle(newTx, node)
                let circleStyler = styler(injectedTx.circle)
                let travelDistance = distanceBtnTwoNodes(injectedTx, node, false)
                tween({
                    from: 0,
                    to: { x: travelDistance.x, y: travelDistance.y},
                    duration: G.txAnimationSpeed,
                    ease: easing.linear
                }).start(circleStyler.set)
                setTimeout(() => {
                    injectedTx.currentPosition.x += travelDistance.x
                    injectedTx.currentPosition.y += travelDistance.y
                    let randomNodes = getRandomActiveNodes(50, node)
                    for (let i = 0; i < randomNodes.length; i += 1) {
                        forwardInjectedTx(injectedTx, randomNodes[i])
                    }
                    injectedTx.circle.remove()    
                }, G.txAnimationSpeed)
                animatedInjection += 1
                if (animatedInjection >= txs) clearInterval(injectInterval)
            }, Math.floor(interval / txs))
        }
    }

    const updateUI = function(previousStatus, currentStatus, publicKey, nodeId) {
        if (previousStatus === 'joining' && currentStatus === 'syncing') {
            relocateIntoNetwork(previousStatus, G.syncing[nodeId])
        } else if (previousStatus === 'syncing' && currentStatus === 'active') {
            let node = G.active[nodeId]
            node.rectangel = drawStateCircle(node)
            node.markerCycle = drawCycleMarkerBox(node)
            node.nodeListCycle = drawNodeListBox(node)
            let circleStyler = styler(node.circle)
            tween({
                from: { fill: `${G.colors['syncing']}` },
                to: { fill: `${G.colors['active']}` },
                duration: 500,
            }).start(circleStyler.set)
        }
    }

    const updateTables = function() {
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
            $('#current-cyclemarker').innerHTML = `${currentCycleMarker.slice(0,4)}...${currentCycleMarker.slice(59,63)}`
        }
    }

    const drawTooltip = function(node) {
        let nodeIdShort = `${node.nodeId.slice(0,4)}...${node.nodeId.slice(59,63)}`
        let cycleMarkerShort = `${node.cycleMarker.slice(0,4)}...${node.cycleMarker.slice(59,63)}`
        let appStateShort = `${node.appState.slice(0,4)}...${node.appState.slice(59,63)}`
        let nodeListShort = `${node.nodelistHash.slice(0,4)}...${node.nodelistHash.slice(59,63)}`
        let tooltipHTML = `
        <div style="text-align: left" id="tooltip-${node.nodeId.slice(0,4)}">
            <p>NodeId: <strong class="tooltip-nodeId">${nodeIdShort}</strong></p>
            <p>Marker: <strong class="tooltip-cycleMarker">${cycleMarkerShort}</strong></p>
            <p>State: <strong class="tooltip-appState">${appStateShort}</strong></p>
            <p>Nodelist: <strong class="tooltip-nodeList">${nodeListShort}</strong></p>
            <p>ExtIP: <strong class="tooltip-extIP">${node.externalIp}</strong></p>
            <p>ExtPort: <strong class="tooltip-extPort">${node.externalPort}</strong></p>
        </div>
        `
        node.circle.setAttribute('data-tippy-content', tooltipHTML)
        let groupId = `group-${node.circle.id.slice(0, 8)}`
        let group = $(`#${groupId}`)
        group.setAttribute('data-tippy-content', tooltipHTML)
        tippy(group, {
            theme: 'tomato',
            animation: 'perspective',
            arrow: true,
            size: 'small',
            duration: [475, 450]
        })
        const instance = group._tippy
        // const instance = node.circle._tippy

        // node.rectangel.setAttribute('data-tippy-content', 'App State')
        // tippy(node.rectangel, {
        //     theme: 'tomato',
        //     animation: 'perspective',
        //     arrow: true,
        //     size: 'small',
        //     duration: [475, 450]
        // })

        // node.markerCycle.setAttribute('data-tippy-content', 'Cyclemarker')
        // tippy(node.markerCycle, {
        //     theme: 'tomato',
        //     animation: 'perspective',
        //     arrow: true,
        //     size: 'small',
        //     duration: [475, 450]
        // })

        // node.nodeListCycle.setAttribute('data-tippy-content', 'Nodelist')
        // tippy(node.nodeListCycle, {
        //     theme: 'tomato',
        //     animation: 'perspective',
        //     arrow: true,
        //     size: 'small',
        //     duration: [475, 450]
        // })
        return instance
    }

    const updateTooltip = function(node) {
        let instance = node.tooltipInstance

        let nodeIdShort = `${node.nodeId.slice(0,4)}...${node.nodeId.slice(59,63)}`
        let cycleMarkerShort = `${node.cycleMarker.slice(0,4)}...${node.cycleMarker.slice(59,63)}`
        let appStateShort = `${node.appState.slice(0,4)}...${node.appState.slice(59,63)}`
        let nodeListShort = `${node.nodelistHash.slice(0,4)}...${node.nodelistHash.slice(59,63)}`
        let tooltipHTML = `
        <div style="text-align: left" id="tooltip-${node.nodeId.slice(0,4)}">
            <p>NodeId: <strong class="tooltip-nodeId">${nodeIdShort}</strong></p>
            <p>Marker: <strong class="tooltip-cycleMarker">${cycleMarkerShort}</strong></p>
            <p>State: <strong class="tooltip-appState">${appStateShort}</strong></p>
            <p>Nodelist: <strong class="tooltip-nodeList">${nodeListShort}</strong></p>
            <p>ExtIP: <strong class="tooltip-extIP">${node.externalIp}</strong></p>
            <p>ExtPort: <strong class="tooltip-extPort">${node.externalPort}</strong></p>
        </div>
        `
        instance.setContent(tooltipHTML)
    }

    const updateStateCircle = function() {
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            if (!node.appState) return

            if (node.rectangel) {
                // update state color
                let circleStyler = styler(node.rectangel)
                tween({
                    from: { fill: `${G.colors['active']}` },
                    to: { fill: `#${node.appState.slice(0, 6)}` },
                    duration: 500,
                }).start(circleStyler.set)
            } else {
                node.rectangel = drawStateCircle(node)
            }
        }
    }

    const updateMarkerCycle = function() {
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            if (!node.cycleMarker) return

            if (node.cycleMarker) {
                // update cycle marker color
                let circleStyler = styler(node.markerCycle)
                tween({
                    from: { fill: `${G.colors['active']}` },
                    to: { fill: `#${node.cycleMarker.slice(0, 6)}` },
                    duration: 500,
                }).start(circleStyler.set)
            } else {
                node.markerCycle = drawCycleMarkerBox(node)
            }
        }
    }

    const updateNodelistCycle = function() {
        for (let nodeId in G.active) {
            let node = G.active[nodeId]
            if (!node.nodelistHash) return

            if (node.nodelistHash) {
                // update nodelist Hash color
                let circleStyler = styler(node.nodeListCycle)
                tween({
                    from: { fill: `${G.colors['active']}` },
                    to: { fill: `#${node.nodelistHash.slice(0, 6)}` },
                    duration: 500,
                }).start(circleStyler.set)
            } else {
                node.nodeListCycle = drawNodeListBox(node)
            }
        }
    }

    const relocateIntoNetwork = function(previousStatus, node) {
        if (previousStatus === 'joining') {
            let circleStyler = styler(node.circle)
            tween({
                from: { fill: `${G.colors['joining']}` },
                to: { fill: `${G.colors['syncing']}` },
                duration: 2000,
            }).start(circleStyler.set)
            let networkPosition = calculateNetworkPosition(parseInt(node.nodeId.substr(0, 4), 16))
            node.despos = networkPosition.degree  // set the desired position of the node
            let x = networkPosition.x
            let y = networkPosition.y
            let initialX = parseFloat(node.circle.getAttribute('cx'))
            let initialY = parseFloat(node.circle.getAttribute('cy'))
            let travelX
            let travelY
    
            travelX = x - initialX
            travelY = y - initialY
            
            // let circleStyler = styler(node.circle)
    
            tween({
                from: 0,
                to: { x: travelX, y: travelY },
                duration: 500,
            }).start(circleStyler.set)
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
            }, 500)
        }
    }

    const positionNewNodeIntoNetwork = function(currentStatus, node) {
        if (currentStatus === 'syncing' || currentStatus === 'active') {
            node.circle.setAttribute('fill', G.colors[currentStatus])
            let networkPosition = calculateNetworkPosition(parseInt(node.nodeId.substr(0, 4), 16))
            node.despos = networkPosition.degree  // set the desired position of the node
            let x = networkPosition.x
            let y = networkPosition.y
            let initialX = parseFloat(node.circle.getAttribute('cx'))
            let initialY = parseFloat(node.circle.getAttribute('cy'))
            let travelX
            let travelY
    
            travelX = x - initialX
            travelY = y - initialY
    
            let circleStyler = styler(node.circle)
    
            tween({
                from: 0,
                to: { x: travelX, y: travelY},
                duration: 1000,
            }).start(circleStyler.set)

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

    const createNewNode = function(type, id) {
        const position = getJoiningNodePosition(id)
        let circleId
        if (type === 'joining') {
            circleId = drawCircle(position, G.nodeRadius, '#272727', 2, id)
            setTimeout(() => {
                let circleStyler = styler($(`#${circleId}`))
                tween({
                    from: { fill: '#272727' },
                    to: { fill: `${G.colors['joining']}` },
                    duration: 2000,
                }).start(circleStyler.set)
            }, 200)
            let circle = $(`#${circleId}`)
            let node = {
                circle: circle,
                circleId: id,
                status: type,
                currentPosition: position
            }
            if (type === 'joining') node.publicKey = id
            return node
        } else {
           circleId = drawCircle(position, G.nodeRadius, G.colors[type], 2, id)
           let circle = $(`#${circleId}`)
           let node = {
               circle: circle,
               circleId: id,
               status: type,
               currentPosition: position
           }
           if (type === 'joining') node.publicKey = id
           return node
        }
    }

    const createNewTx = function() {
        return {
            timestamp: Date.now()
        }
    }

    const createNewTxCircle = function(inputTx, toNode) {
        let x = G.X + 1.5*(toNode.currentPosition.x - G.X)
        let y = G.Y + 1.5*(toNode.currentPosition.y - G.Y)
        let circleId = drawCircle({x: x, y: y}, "5px", G.colors['transaction'], 2)
        let circle = $(`#${circleId}`)
        let currentPosition = {
            x: parseFloat(circle.getAttribute('cx')),
            y: parseFloat(circle.getAttribute('cy')),
        }
        let tx = {
            circle: circle,
            circleId: circleId,
            currentPosition,
            data: inputTx
        }
        return tx
    }

    const cloneTxCircle = function(txCircle) {
        let circleId = drawCircle({x: txCircle.currentPosition.x, y: txCircle.currentPosition.y}, "5px", G.colors['transaction'], "0")
        let circle = $(`#${circleId}`)
        let clone =  Object.assign({}, txCircle)
        clone.circle = circle
        clone.circleId = circleId
        return clone
    }

    const drawStateCircle = function(node) {
        if(!node.appState) return
        let radius = G.stateCircleRadius
        let rectId =`abc${node.nodeId.substr(0, 6)}xyz`
        let stateRec = makeSVGEl('circle', {
            id: rectId,
            cx: node.currentPosition.x,
            cy: node.currentPosition.y + radius,
            r: G.stateCircleRadius,
            fill: `#${node.appState.slice(0, 6)}`,
            opacity: 0
        })
        let group = node.circle.parentNode
        group.appendChild(stateRec)
        
        let circleStyler = styler($(`#${rectId}`))
        setTimeout(() => {
            tween({
                from: 0,
                to: { opacity: 1},
                duration: 500,
            }).start(circleStyler.set)
        }, 1000)
        return $(`#${rectId}`)
    }

    const drawCycleMarkerBox = function(node) {
        if(!node.cycleMarker) return

        let radius = G.stateCircleRadius
        let x = 2 * radius * Math.cos(Math.PI / 4)
        let y = 2 * radius * Math.sin(Math.PI / 4)

        let rectId =`cycleMarkerBox${node.nodeId.substr(0, 6)}xyz`
        let cycleMarkerBox = makeSVGEl('circle', {
            id: rectId,
            cx: node.currentPosition.x + radius,
            cy: node.currentPosition.y - radius,
            r: G.stateCircleRadius,
            fill: `#${node.cycleMarker.slice(0, 6)}`,
            opacity: 0
        })
        let group = node.circle.parentNode
        group.appendChild(cycleMarkerBox)
        let circleStyler = styler($(`#${rectId}`))
        setTimeout(() => {
            tween({
                from: 0,
                to: { opacity: 1},
                duration: 500,
            }).start(circleStyler.set)
        }, 1000)
        return $(`#${rectId}`)
    }

    const drawNodeListBox = function(node) {
        if(!node.nodelistHash) return

        let radius = G.stateCircleRadius
        let x = 2 * radius * Math.cos(Math.PI / 4)
        let y = 2 * radius * Math.sin(Math.PI / 4)

        let rectId =`nodeListBox${node.nodeId.substr(0, 6)}xyz`
        let cycleMarkerBox = makeSVGEl('circle', {
            id: rectId,
            cx: node.currentPosition.x - radius,
            cy: node.currentPosition.y - radius,
            r: G.stateCircleRadius,
            fill: `#${node.nodelistHash.slice(0, 6)}`,
            opacity: 0
        })
        let group = node.circle.parentNode
        group.appendChild(cycleMarkerBox)
        let circleStyler = styler($(`#${rectId}`))
        setTimeout(() => {
            tween({
                from: 0,
                to: { opacity: 1},
                duration: 500,
            }).start(circleStyler.set)
        }, 1000)
        return $(`#${rectId}`)
    }

    const drawCircle = function(position, radius, fill, stroke, id, tooltip) {
        let circleId
        if(id) circleId = `abc${id.substr(0, 4)}xyz`
        else circleId = `abc${parseInt(Date.now() * Math.random())}xyz`
        let circleSVG
        circleSVG = `
        <g id="group-${circleId.slice(0, 8)}">
            <circle cx="${position.x}" cy="${position.y}" r="${radius}" stroke="#eeeeee" stroke-width="0" fill="${fill}" id="${circleId}" key="${id}" class="joining-node" opacity="1.0"/>
        </g>
        `
        $('.background').insertAdjacentHTML('beforeend', circleSVG)
        let circleStyler = styler($(`#${circleId}`))
        tween({
            from: 0,
            to: { opacity: 1 },
            duration: 100,
        }).start(circleStyler.set)

        return circleId
    }

    const distanceBtnTwoNodes = function(node1, node2, substract) {
        let X = node2.currentPosition.x - node1.currentPosition.x
        let Y = node2.currentPosition.y - node1.currentPosition.y
        let R = G.nodeRadius
        let radian = Math.atan(Y / X)
        let x = R * Math.cos(radian)
        let y = R * Math.sin(radian)

        let xFactor = 1
        let yFactor = 1

        if (X < 0) xFactor = -1
        if (Y < 0) yFactor = -1

        if (substract) return {
            x: X - xFactor * Math.sqrt(x * x),
            y: Y - yFactor * Math.sqrt(y * y)
        }
        return {
            x: X,
            y: Y
        }
    }
    const distanceBtnTwoPoints = function(p1, p2) {
        let dx = p1.x - p2.x
        let dy = p1.y - p2.y
        let distance = Math.sqrt(dx ** 2 + dy ** 2)
        return distance
    }

    const getRandomActiveNodes = function(count, excludedNode = null) {
        let nodeList = []
        for (let nodeId in G.active) {
            nodeList.push(G.active[nodeId])
        }
        let randomNodes = []
        let n
        if (excludedNode) nodeList = nodeList.filter(n => n.circleId !== excludedNode.circleId)
        if (nodeList.length === 0) return []
        if (nodeList.length < count) n = nodeList.length
        else n = count
        for (let i = 0; i < n; i += 1) {
            let item = nodeList[Math.floor(Math.random() * nodeList.length)]
            randomNodes.push(item)
            nodeList = nodeList.filter(n => n.circleId !== item.circleId)
        }
        return randomNodes
    }

    const forwardInjectedTx = function(injectedTx, targetNode) {
        let clone = cloneTxCircle(injectedTx)
        let circleStyler = styler(clone.circle)
        let travelDistance = distanceBtnTwoNodes(clone, targetNode, true)
        let dur = Math.sqrt(travelDistance.x**2 + travelDistance.y**2)
        dur = dur < 100 ? 100 : dur * 2
        tween({
            from: 0,
            to: { x: travelDistance.x, y: travelDistance.y},
            duration: dur,
            ease: easing.linear
        }).start(circleStyler.set)
        setTimeout(() => {
            clone.circle.remove()
        }, dur)
    }

    const calculateNetworkPosition = function(nodeId) {
        let degree = 360 - (nodeId / G.maxId) * 360
        let radian = degree *  Math.PI / 180
        let x = G.R * Math.cos(radian) + G.X
        let y = G.R * Math.sin(radian) + G.Y
        return {x, y, degree}
    }

    const adjustNodePosition = function() {
        let syncingNodes = Object.values(G.syncing)
        let activeNodes = Object.values(G.active)
        let nodes = syncingNodes.concat(activeNodes)
        let nodeList = nodes.filter(node => node.degree !== undefined)
        for (let i = 0; i < nodeList.length; i++) {
          nodeList[i].newpos = nodeList[i].despos
        }
        for (let i = 0; i < 20; i++){
            stepNodePosition(nodeList);
        }
        for (let i = 0; i < nodeList.length; i++) {
            shiftNearestNode(nodeList[i], nodeList[i].newpos )
        }
    }

    const stepNodePosition = function(nodeList) {
        let F_array = []
        let s = 1
        let k = 5

        for (let i = 0; i < nodeList.length; i++) {
            let dArray = []
            let F = 0
            for (let j=0; j < nodeList.length; j++) {
                if (j==i){ continue } // TODO attract to where we want to be
                let d = nodeList[i].newpos - nodeList[j].newpos
                if (d > 180) d = d - 360 
                if (d < -180) d = 360 + d
                let sign_d = 1
                if (d < 0) sign_d = -1
                F = F + k * (sign_d / (Math.abs(d)+s))
            }
            F_array[i] = F
        }
        for (let i = 0; i < nodeList.length; i++) {
            nodeList[i].newpos += F_array[i]
            if (nodeList[i].newpos > 360){ nodeList[i].newpos -= 360 }
            if (nodeList[i].newpos <   0){ nodeList[i].newpos += 360 }
        }
    }

    const shiftNearestNode = function(node, newDegree) {  // new degree instead of delta
        let degree = newDegree
        let radian = degree *  Math.PI / 180;
        let x = G.R * Math.cos(radian) + G.X
        let y = G.R * Math.sin(radian) + G.Y
        let initialX = node.initialPosition.x
        let initialY = node.initialPosition.y
        let travelX
        let travelY
        let circleStyler = styler(node.circle)
        let animationStartX = node.currentPosition.x - initialX
        let animationStartY = node.currentPosition.y - initialY

        travelX = x - node.currentPosition.x
        travelY = y - node.currentPosition.y

        if (travelX === 0 && travelY === 0) {
            return
        }

        if (node.status === 'active') {
            let radius = G.stateCircleRadius
            // move app state circle
            let initialX = node.rectangel.getAttribute('cx')
            let initialY = node.rectangel.getAttribute('cy')

            let animationStartX = node.currentPosition.x - initialX
            let animationStartY = node.currentPosition.y - initialY

            travelX = x - node.currentPosition.x
            travelY = y - node.currentPosition.y

            let rectangelStyler = styler(node.rectangel)
            tween({
                from: { x: animationStartX, y: animationStartY},
                to: { x: animationStartX + travelX , y: animationStartY + travelY + radius },
                duration: 500,
            }).start(rectangelStyler.set)

            // move cyclemarker cycle
            let initialXm = node.markerCycle.getAttribute('cx')
            let initialYm = node.markerCycle.getAttribute('cy')

            let animationStartXm = node.currentPosition.x - initialXm
            let animationStartYm = node.currentPosition.y - initialYm
            
            travelXm = x - node.currentPosition.x
            travelYm = y - node.currentPosition.y

            let markerStyler = styler(node.markerCycle)
            tween({
                from: { x: animationStartXm, y: animationStartYm},
                to: { x: animationStartXm + travelXm + radius , y: animationStartYm + travelYm - radius },
                duration: 500,
            }).start(markerStyler.set)

            // move nodelist cycle
            let initialXn = node.nodeListCycle.getAttribute('cx')
            let initialYn = node.nodeListCycle.getAttribute('cy')

            let animationStartXn = node.currentPosition.x - initialXn
            let animationStartYn = node.currentPosition.y - initialYn
            
            travelXn = x - node.currentPosition.x
            travelYn = y - node.currentPosition.y

            let nodeListStyler = styler(node.nodeListCycle)
            tween({
                from: { x: animationStartXn, y: animationStartYn},
                to: { x: animationStartXn + travelXn - radius , y: animationStartYn + travelYn - radius },
                duration: 500,
            }).start(nodeListStyler.set)
        }

        tween({
            from: { x: animationStartX, y: animationStartY},
            to: { x: animationStartX + travelX, y: animationStartY + travelY},
            duration: 500,
        }).start(circleStyler.set)

        node.currentPosition.x = x
        node.currentPosition.y = y
        node.degree = degree
    }
    
    const drawNetworkCycle = function(R, X, Y) {
        let networkHTML = `
        <button id="reset-report">Reset Report</button>
        <table id="node-info-table">
            <thead>
                <tr>
                    <td>Joining</td>
                    <td>Syncing</td>
                    <td>Active</td>
                    <td>Total</td>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td id="node-info-joining">0</td>
                    <td id="node-info-syncing">0</td>
                    <td id="node-info-active">0</td>
                    <td id="node-info-total">0</td>
                </tr>
            </tbody>
        </table>
        <table id="cyclemarker-table">
            <thead>
                <tr>
                    <td>Cycle Marker</td>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td id="current-cyclemarker">-</td>
                </tr>
            </tbody>
        </table>
        <img src="earth.png" alt="" id="earth">
        <svg height="100%" width="100%" class="background" style="top: 0px; left: 0px">
            <circle cx="${X}" cy="${Y}" r="${R}" stroke="green" stroke-width="1" fill="#ffffff" id="networkCircle" opacity="0.1"/>
        </svg>
        `
        $('#app').innerHTML = networkHTML
        let earth = $('#earth')
        let earthSize = (R - 0) * 2
        earth.style.width = `${earthSize}px`
        earth.style.height = `${earthSize}px`
        earth.style.position = 'absolute'
        earth.style.display = 'block'
        earth.style.top = `${G.VH / 2 - earthSize / 2 + 8}px`
        earth.style.left = `${G.VW / 2 - earthSize / 2 + 8}px`
    }

    const getReport = async function() {
        let response = await axios.get(`${G.monitorServerUrl}/report`)
        return response.data
    }

    const flushReport = async function() {
        let response = await axios.get(`${G.monitorServerUrl}/flush`)
        document.location.reload()
    }

    const getRandomPosition = function() {
        let randomAngle = Math.random() * 360
        let maxRadius
        if (G.VW < G.VH) maxRadius = G.VW / 2 - G.nodeRadius
        else maxRadius = G.VH / 2 - G.nodeRadius
        let randomRadius = Math.random() * (maxRadius - G.R) + G.R + 50
        let x = randomRadius * Math.sin(randomAngle)
        let y = randomRadius * Math.cos(randomAngle)
        return {x: x + G.X, y: y + G.Y}
    }

    const getNearestNodeFromPoint = function(point) {
        let joiningNodes = Object.values(G.joining)
        let sortedNodes = joiningNodes.sort((n1, n2) => {
            return distanceBtnTwoPoints(point, n1.currentPosition) - distanceBtnTwoPoints(point, n2.currentPosition)
        })
        return sortedNodes[0]
    }

    const getJoiningPosition = function() {
        let selectedDistance = 0
        let selectedPosition
        let minimumDistance = 2.5 * G.nodeRadius
        if (Object.keys(G.joining).length === 0) return getRandomPosition()

        while (selectedDistance < minimumDistance) {
            let randomPositions = []
            let nearestNodes = []
            let distanceFromNearestNode = []
            for (let i = 0; i < 3; i += 1) randomPositions.push(getRandomPosition())
            for (let i = 0; i < 3; i += 1) nearestNodes.push(getNearestNodeFromPoint(randomPositions[i]))
            for (let i = 0; i < 3; i += 1) {
                distanceFromNearestNode.push({
                    distance: distanceBtnTwoPoints(randomPositions[i], nearestNodes[i].currentPosition),
                    position: randomPositions[i]
                })
            }
            let sorted = distanceFromNearestNode.sort((d1, d2) => d2.distance - d1.distance)
            selectedDistance = sorted[0].distance
            selectedPosition = sorted[0].position
        }
        return selectedPosition
    }

    const getJoiningNodePosition = function(publicKey) {
        let minimumRadius = G.R + 2.5 * G.nodeRadius
        let angle = 360 * parseInt(publicKey.slice(0, 4), 16) / G.maxId
        let radiusFactor =  parseInt(publicKey.slice(4, 8), 16) / G.maxId
        let radius = radiusFactor * (50) + minimumRadius

        let x = radius * Math.sin(angle * Math.PI / 180)
        let y = radius * Math.cos(angle * Math.PI / 180)
        return {x: x + G.X, y: y + G.Y}
    }

    const makeSVGEl = function (tag, attrs) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs) {
          el.setAttribute(k, attrs[k]);
        }
        return el;
    }

    init()
}

