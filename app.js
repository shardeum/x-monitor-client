/*

- Start the page with just a large green circle outline.
- When the user clicks outside the circle create a new gray node there.
- When the user clicks on a gray node randomly assign it a node id (two byte) and move it - - to the green circle and change the color to yellow.
- When the user clicks on a yellow node change the node to active and make it green.

When the user clicks on a green node show a transaction coming from outside the large circle to the node and then the node sending the tx to up to 2 other randomly picked nodes that are active (green).
*/

window.$ = function(selector) { // shorthand for document selector
    let elements = document.querySelectorAll(selector)
    if (elements.length === 1) return elements[0]
    return elements
}

let { tween, styler, listen, pointer, timeline } = window.popmotion


let NetworkMonitor = function(config) {
    
    let G = {} // semi-global namespace
    G.nodes = []
    G.VW = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    G.VH = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    G.R = config.networkCircleRadius || 200
    G.X = config.networkCircleX || G.VW / 2
    G.Y = config.networkCircleY || G.VH / 2
    
    G.maxId = 100000

    const init = function () {
        drawNetworkCycle(G.R, G.X, G.Y)
        $('.background').addEventListener('click', e => {
            e.stopImmediatePropagation()
            let parentTop = e.target.style.top.split('px')[0]
            let parentLeft = e.target.style.left.split('px')[0]

            var x = event.pageX - parseFloat(parentLeft);
            var y = event.pageY - parseFloat(parentTop);

            let newNode = createNewNode({x, y})

            let circleStyler = styler(newNode.circle)

            newNode.circle.addEventListener('click', e => {
                e.stopImmediatePropagation()
                
                if (newNode.status === 'request') {
                    newNode.nodeId = (Math.random() * G.maxId).toFixed(0)
                    newNode.circle.setAttribute('fill', '#f9cb35')
                    let networkPosition = calculateNetworkPosition(newNode.nodeId)
                    newNode.despos = networkPosition.degree  // set the desired position of the node
                    let x = networkPosition.x
                    let y = networkPosition.y
                    let initialX = parseFloat(newNode.circle.getAttribute('cx'))
                    let initialY = parseFloat(newNode.circle.getAttribute('cy'))
                    let travelX
                    let travelY

                    travelX = x - initialX
                    travelY = y - initialY

                    let circleStyler = styler(newNode.circle)

                    tween({
                        from: 0,
                        to: { x: travelX, y: travelY},
                        duration: 1000,
                    }).start(circleStyler.set)
                    newNode.status = 'syncing'
                    newNode.initialPosition = {
                        x: initialX,
                        y: initialY
                    }
                    newNode.currentPosition = {
                        x: x,
                        y: y
                    }
                    newNode.degree = networkPosition.degree
                    setTimeout(() => {
                        adjustNodePosition()
                    }, 1000)
                } else if (newNode.status === 'syncing') {
                    let circleStyler = styler(newNode.circle)
                    newNode.status = 'active'
                    tween({
                        from: { fill: '#f9cb35' },
                        to: { fill: '#4caf50' },
                        duration: 500,
                    }).start(circleStyler.set)
                } else if (newNode.status === 'active') {
                    let newTx = createNewTx()
                    let injectedTx = createNewTxCircle(newTx, newNode)
                    let circleStyler = styler(injectedTx.circle)
                    let travelDistance = distanceBtnTwoNodes(injectedTx, newNode)
                    tween({
                        from: 0,
                        to: { x: travelDistance.x, y: travelDistance.y},
                        duration: 500,
                    }).start(circleStyler.set)

                    setTimeout(() => {
                        injectedTx.currentPosition.x += travelDistance.x
                        injectedTx.currentPosition.y += travelDistance.y
                        let randomNodes = getRandomNodes(50, newNode)
                        for (let i = 0; i < randomNodes.length; i += 1) {
                            forwardInjectedTx(injectedTx, randomNodes[i])
                        }
                        injectedTx.circle.remove()    
                    }, 500)
                }
            })
            G.nodes.push(newNode)
        })
        
        $('#networkCircle').addEventListener('click', e => {
            e.stopImmediatePropagation()
            console.log('clicked on network circle')
        })
    }

    const createNewNode = function(position) {
        let circleId = drawCircle(position, config.nodeRadius, "gray", 2)
        let circle = $(`#${circleId}`)
        let currentPosition = {
            x: parseFloat(circle.getAttribute('cx')),
            y: parseFloat(circle.getAttribute('cy')),
        }
        let node = {
            circle: circle,
            circleId: circleId,
            status: 'request',
            currentPosition: currentPosition
        }
        return node
    }

    const createNewTx = function() {
        return {
            timestamp: Date.now()
        }
    }

    const createNewTxCircle = function(inputTx, toNode) {
        let x = G.X + 1.5*(toNode.currentPosition.x - G.X)
        let y = G.Y + 1.5*(toNode.currentPosition.y - G.Y)
        let circleId = drawCircle({x: x, y: y}, "5px", "red", "0")
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
        let circleId = drawCircle({x: txCircle.currentPosition.x, y: txCircle.currentPosition.y}, "5px", "red", "0")
        let circle = $(`#${circleId}`)
        let clone =  Object.assign({}, txCircle)
        clone.circle = circle
        clone.circleId = circleId
        return clone
    }

    const drawCircle = function(position, radius, fill, stroke) {
        let circleId = `abc${(Date.now() * Math.random() * 100).toFixed(0)}xyz`
        let circleSVG = `<circle cx="${position.x}" cy="${position.y}" r="${radius}" stroke="#eeeeee" stroke-width="0" fill="${fill}" id="${circleId}" class="request-node"/>`
        $('.background').insertAdjacentHTML('beforeend', circleSVG)
        return circleId
    }

    const distanceBtnTwoNodes = function(node1, node2) {
        return {
            x: node2.currentPosition.x - node1.currentPosition.x,
            y: node2.currentPosition.y - node1.currentPosition.y
        }
    }

    const getRandomNodes = function(count, excludedNode = null) {
        let nodeList = G.nodes.filter(n => n.status === 'active')
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
        let travelDistance = distanceBtnTwoNodes(clone, targetNode)
        tween({
            from: 0,
            to: { x: travelDistance.x, y: travelDistance.y},
            duration: 500,
        }).start(circleStyler.set)
        setTimeout(() => {
            clone.circle.remove()
        }, 500)
    }

    const calculateNetworkPosition = function(nodeId) {
        let degree = 360 - (nodeId / G.maxId) * 360
        let radian = degree *  Math.PI / 180
        let x = G.R * Math.cos(radian) + G.X
        let y = G.R * Math.sin(radian) + G.Y
        return {x, y, degree}
    }

    const adjustNodePosition = function() {
        let nodeList = G.nodes
            .filter(node => node.degree !== undefined)
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
        <svg height="100%" width="100%" class="background" style="top: 0px; left: 0px">
            <circle cx="${X}" cy="${Y}" r="${R}" stroke="green" stroke-width="1" fill="#ffffff" id="networkCircle"/>
        </svg>
        `
        $('#app').innerHTML = networkHTML
    }

    init()
}

