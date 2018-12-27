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

let NetworkMonitor = function() {

    let nodes = []

    let once = { once : true }

    let R = 200
    let X = 400
    let Y = 400

    const init = function () {
        $('.background').addEventListener('click', e => {
            e.stopImmediatePropagation()
            let parentTop = e.target.style.top.split('px')[0]
            let parentLeft = e.target.style.left.split('px')[0]

            var x = event.pageX - parseFloat(parentLeft);
            var y = event.pageY - parseFloat(parentTop);

            let newNode = createNewNode('request', {x, y})
            newNode.circle.addEventListener('click', e => {
                e.stopImmediatePropagation()
                
                if (newNode.status === 'request') {
                    newNode.nodeId = (Math.random() * 100000).toFixed(0)
                    newNode.circle.setAttribute('fill', '#f9cb35')
                    let networkPosition = calculateNetworkPosition(newNode.nodeId)
                    let x = networkPosition.x
                    let y = networkPosition.y
                    let currentX = newNode.circle.getAttribute('cx')
                    let currentY = newNode.circle.getAttribute('cy')
                    let travelX
                    let travelY

                    travelX = x - currentX
                    travelY = y - currentY

                    let circleStyler = styler(newNode.circle)

                    tween({
                        from: 0,
                        to: { x: travelX, y: travelY},
                        duration: 1000,
                    }).start(circleStyler.set)
                    newNode.status = 'syncing'
                    newNode.currentPosition.x += travelX
                    newNode.currentPosition.y += travelY
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
                    let injectedTx = createNewTxCircle(newTx)
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

                        let randomNodes = getRandomNodes(2, newNode)

                        for (let i = 0; i < randomNodes.length; i += 1) {
                            forwardInjectedTx(injectedTx, randomNodes[i])
                        }
                        injectedTx.circle.remove()    
                    }, 500)
                    
                }
            })
            nodes.push(newNode)
        })
        
        $('#networkCircle').addEventListener('click', e => {
            e.stopImmediatePropagation()
            console.log('clicked on network circle')
        })
    }

    const createNewNode = function(type, position) {
        switch(type) {
            case "request":
                let circleId = drawCircle(position, "25px", "gray", "2px")
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
    }

    const createNewTx = function() {
        return {
            timestamp: Date.now(),
        }
    }

    const createNewTxCircle = function(inputTx) {
        let circleId = drawCircle({x: 0, y: 0}, "5px", "red", "0px")
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
        let circleId = drawCircle({x: txCircle.currentPosition.x, y: txCircle.currentPosition.y}, "5px", "red", "0px")
        let circle = $(`#${circleId}`)

        let clone =  Object.assign({}, txCircle)
        clone.circle = circle
        clone.circleId = circleId
        return clone
    }

    const drawCircle = function(position, radius, fill, stroke) {
        let circleId = `abc${(Date.now() * Math.random() * 100).toFixed(0)}xyz`
        let circleSVG = `<circle cx="${position.x}" cy="${position.y}" r="${radius}" stroke="#eeeeee" stroke-width="${stroke}" fill="${fill}" id="${circleId}" class="request-node"/>`
        $('.background').insertAdjacentHTML('beforeend', circleSVG)
        return circleId
    }

    const distanceBtnTwoNodes = function(node1, node2) {

        return {
            x: node2.currentPosition.x - node1.currentPosition.x,
            y: node2.currentPosition.y - node1.currentPosition.y
        }
    }

    const getRandomNodes = function(num, excludedNode = null) {
        let nodeList = nodes.filter(n => n.status === 'active')
        let randomNodes = []

        if (excludedNode) nodeList = nodeList.filter(n => n.circleId !== excludedNode.circleId)

        if (nodeList.length === 0) return []

        let n
        if (nodeList.length < num) n = nodeList.length
        else n = num

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
        const maxId = 100000
        let degree = 270 - (nodeId / maxId) * 360
        let radian = degree *  Math.PI / 180;
        let x = R * Math.cos(radian) + X
        let y = R * Math.sin(radian) + Y
        return {x, y}

    }

    init()
}


