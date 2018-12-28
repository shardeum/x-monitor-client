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
    let nodes = []
    let R = config.networkCircleRadius || 200
    let X = config.networkCircleX || 400
    let Y = config.networkCircleY || 400
    let r = config.nodeRadius || 25
    let alpha = 2 * Math.asin(r / R) * (180 / Math.PI)

    const init = function () {
        drawNetworkCycle(R, X, Y)
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
                    newNode.nodeId = (Math.random() * 100000).toFixed(0)
                    newNode.circle.setAttribute('fill', '#f9cb35')
                    let networkPosition = calculateNetworkPosition(newNode)
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
                    // setTimeout(() => shiftNearestNode(newNode, 45), 1000)
                    newNode.degree = networkPosition.degree
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

    const createNewTxCircle = function(inputTx) {
        let circleId = drawCircle({x: 0, y: 0}, "5px", "red", "0")
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
        let nodeList = nodes.filter(n => n.status === 'active')
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

    const calculateNetworkPosition = function(node) {
        const maxId = 100000
        // let degree = 360 - (node.nodeId / maxId) * 360
        let degree = 0

        let nodeList = nodes
            .filter(node => node.degree !== undefined)

        if (nodeList.length > 0) {
            let isOverlap = true
            let nearestNodes = getNearestNode(degree)
            isOverlap = checkOverlap(degree, nearestNodes.degree)

            let leftOverlap
            let rightOverlap

            if(nearestNodes.leftNode.length > 0 && nearestNodes.rightNode.length === 0) {
                
                leftOverlap = checkOverlap(degree, nearestNodes.leftNode[0].degree)
                if(leftOverlap) shiftNearestNode(nearestNodes.leftNode[0], -alpha/2)

                for (let i = 1; i < nearestNodes.leftNode.length; i += 1 ) {
                    let isLeftClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                    console.log(`isLeftClash : ${isLeftClash}`)
                    if (isLeftClash) shiftNearestNode(nearestNodes.leftNode[i], -alpha/2)
                }

                // let leftMostNode = nearestNodes.leftNode[nearestNodes.leftNode.length - 1]
                // let lastLeftVsNodeCheck = checkOverlap(leftMostNode.degree, degree)

                // console.log(`lastLeftVsNodeCheck : ${lastLeftVsNodeCheck}`)

                // if (lastLeftVsNodeCheck) {
                //     shiftNearestNode(leftMostNode, alpha)
                //     for (let i = nearestNodes.leftNode.length - 1; i > 0; i += 1 ) {
                //         let reverseClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                //         console.log(`reverseClash : ${reverseClash}`)
                //         if (reverseClash) shiftNearestNode(nearestNodes.leftNode[i], alpha/2)
                //     }
                // }

                console.log(leftOverlap, rightOverlap)
                console.log(nearestNodes.leftNode)
                console.log(nearestNodes.rightNode)
                degree = degree + (alpha / 2)
            } else if(nearestNodes.leftNode.length === 0 && nearestNodes.rightNode.length > 0) {

                rightOverlap = checkOverlap(degree, nearestNodes.rightNode[0].degree)
                if(rightOverlap) shiftNearestNode(nearestNodes.rightNode[0], alpha/2)

                for (let i = 1; i < nearestNodes.rightNode.length; i += 1 ) {
                    let isRightClash = checkOverlap(nearestNodes.rightNode[i].degree, nearestNodes.rightNode[i - 1].degree)
                    console.log(`isClash is ${isRightClash}`)
                    if (isRightClash) shiftNearestNode(nearestNodes.rightNode[i], alpha/2)
                }


                let rightMostNode = nearestNodes.rightNode[nearestNodes.rightNode.length - 1]
                let lastRightVsNodeCheck = checkOverlap(rightMostNode.degree, degree)

                console.log(`lastRightVsNodeCheck : ${lastRightVsNodeCheck}`)

                // if (lastRightVsNodeCheck) {
                //     shiftNearestNode(rightMostNode, alpha)
                //     for (let i = nearestNodes.leftNode.length - 1; i > 0; i += 1 ) {
                //         let reverseClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                //         console.log(`reverseClash : ${reverseClash}`)
                //         if (reverseClash) shiftNearestNode(nearestNodes.leftNode[i], alpha/2)
                //     }
                // }

                console.log(leftOverlap, rightOverlap)
                console.log(nearestNodes.leftNode)
                console.log(nearestNodes.rightNode)
                // degree = degree + (-alpha / 2)
            } else if(nearestNodes.leftNode.length > 0 && nearestNodes.rightNode.length > 0) {
                leftOverlap = checkOverlap(degree, nearestNodes.leftNode[0].degree)
                rightOverlap = checkOverlap(degree, nearestNodes.rightNode[0].degree)
                console.log(leftOverlap, rightOverlap)
                // console.log(nearestNodes.leftNode)
                // console.log(nearestNodes.rightNode)
                if(leftOverlap && rightOverlap) {
                    
                    shiftNearestNode(nearestNodes.leftNode[0], -alpha/2)
                    for (let i = 1; i < nearestNodes.leftNode.length; i += 1 ) {
                        let isLeftClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                        console.log(`isLeftClash : ${isLeftClash}`)
                        if (isLeftClash) shiftNearestNode(nearestNodes.leftNode[i], -alpha/2)
                    }

                    shiftNearestNode(nearestNodes.rightNode[0], alpha/2)
                    for (let i = 1; i < nearestNodes.rightNode.length; i += 1 ) {
                        let isRightClash = checkOverlap(nearestNodes.rightNode[i].degree, nearestNodes.rightNode[i - 1].degree)
                        console.log(nearestNodes.rightNode[i].degree, nearestNodes.rightNode[i - 1].degree)
                        console.log(`isRightClash : ${isRightClash}`)
                        if (isRightClash) shiftNearestNode(nearestNodes.rightNode[i], alpha/2)
                    }
                    node.circle.setAttribute('fill', 'red')

                    let numberOfOverlaps = getOverlapCount()

                    console.log(`Number of overlap is ${numberOfOverlaps}`)

                } else if (leftOverlap && !rightOverlap) {
                    shiftNearestNode(nearestNodes.leftNode[0], -alpha/2)
                    for (let i = 1; i < nearestNodes.leftNode.length; i += 1 ) {
                        let isLeftClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                        if (isLeftClash) shiftNearestNode(nearestNodes.leftNode[i], -alpha/2)
                    }

                    degree = degree + (alpha / 2)

                    let initialRightClash = checkOverlap(nearestNodes.rightNode[0].degree, degree)
                    console.log(`initialRightClash is ${initialRightClash}`)
                    if (initialRightClash) {
                            shiftNearestNode(nearestNodes.rightNode[0], alpha/2)
                    }

                    for (let i = 1; i < nearestNodes.rightNode.length; i += 1 ) {
                        let isRightClash = checkOverlap(nearestNodes.rightNode[i].degree, nearestNodes.rightNode[i - 1].degree)
                        console.log(`isClash is ${isRightClash}`)
                        if (isRightClash) shiftNearestNode(nearestNodes.rightNode[i], alpha/2)
                    }
                    
                } else if (!leftOverlap && rightOverlap) {
                    shiftNearestNode(nearestNodes.rightNode[0], alpha/2)
                    for (let i = 1; i < nearestNodes.rightNode.length; i += 1 ) {
                        let isRightClash = checkOverlap(nearestNodes.rightNode[i].degree, nearestNodes.rightNode[i - 1].degree)
                        if (isRightClash) shiftNearestNode(nearestNodes.rightNode[i], alpha/2)
                    }

                    degree = degree + (-alpha / 2)

                    let initialLeftClash = checkOverlap(nearestNodes.leftNode[0].degree, degree)
                    console.log(`initialLeftClash is ${initialLeftClash}`)
                    if (initialLeftClash) {
                            shiftNearestNode(nearestNodes.leftNode[0], -alpha/2)
                    }
                    for (let i = 1; i < nearestNodes.leftNode.length; i += 1 ) {
                        let isLeftClash = checkOverlap(nearestNodes.leftNode[i].degree, nearestNodes.leftNode[i - 1].degree)
                        if (isLeftClash) shiftNearestNode(nearestNodes.leftNode[i], -alpha/2)
                    }
                }
            }
            if (degree > 360) degree -= 360
        }

        let radian = degree *  Math.PI / 180;
        let x = R * Math.cos(radian) + X
        let y = R * Math.sin(radian) + Y
        node.degree = degree
        return {x, y, degree}
    }

    const shiftNearestNode = function(node, shiftDegree) {
        let degree = node.degree + shiftDegree
        if (degree < 0) degree = 360 + degree
        console.log(degree)
        let radian = degree *  Math.PI / 180;
        let x = R * Math.cos(radian) + X
        let y = R * Math.sin(radian) + Y

        let initialX = node.initialPosition.x
        let initialY = node.initialPosition.y
        let travelX
        let travelY

        let circleStyler = styler(node.circle)

        let animationStartX = node.currentPosition.x - initialX
        let animationStartY = node.currentPosition.y - initialY

        travelX = x - node.currentPosition.x
        travelY = y - node.currentPosition.y

        // console.log(`Shifted degree is ${degree}`)
        // console.log(initialX, initialY)
        // console.log(node.currentPosition.x, node.currentPosition.y)
        // console.log(x, y)
        // console.log(animationStartX, animationStartY)
        // console.log(travelX, travelY)

        tween({
            from: { x: animationStartX, y: animationStartY},
            to: { x: animationStartX + travelX, y: animationStartY + travelY},
            duration: 500,
        }).start(circleStyler.set)
        node.currentPosition.x = x
        node.currentPosition.y = y
        node.degree = degree
        node.circle.setAttribute('fill', 'blue')
        setTimeout(() => {
            node.circle.setAttribute('fill', '#f9cb35')   
        }, 3000)
    }

    const getNearestNode = function(degree) {
        let nodeList = nodes
            .filter(node => node.degree !== undefined)
            .sort((a, b) => Math.abs(a.degree - degree) - Math.abs(b.degree - degree))
        let leftNode
        let rightNode
        if (nodeList.length > 0) {
            leftNode = nodeList.filter(n => n.degree <= degree)
            rightNode = nodeList.filter(n => n.degree > degree)
            return {
                leftNode, rightNode
            }
        }
    }

    const getOverlapCount = function() {
        let count = 0
        let nodeList = nodes
            .filter(node => node.degree !== undefined)
            .sort((a, b) => a.degree - b.degree)

        console.log(nodeList.map(n => n.degree))

        let totalNodes = nodeList.length
        for (let i = 0; i < totalNodes; i++) {
            if (checkOverlap(nodeList[i], nodeList[i+1])) count += 1
        }
        // edge case
        if (checkOverlap(nodeList[totalNodes-1], nodeList[0])) count += 1
        return count
    }

    const checkOverlap = function(degree, nearestDegree) {
        if (degree === nearestDegree) {
            return true
        } else if (degree > nearestDegree) {
            if (degree - alpha < nearestDegree) return true
            else return false
        } else if (degree < nearestDegree) {
            if (degree + alpha > nearestDegree) return true
            else return false
        }
        return false
    }

    const drawNetworkCycle = function(R, X, Y) {
        let networkHTML = `
        <svg height="100%" width="100%" class="background" style="top: 0px; left: 0px">
            <circle cx="${X}" cy="${Y}" r="${R}" stroke="green" stroke-width="3" fill="#f1f1f1" id="networkCircle"/>
        </svg>
        `
        $('#app').innerHTML = networkHTML
    }

    init()
}


