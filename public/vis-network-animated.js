/**
 * Animates traffic between nodes on a visjs canvas. This is achieved
 * by drawing a canvas on top of the existing canvas since visjs does
 * not support edge animations natively
 *
 * Inspired by: https://github.com/almende/vis/issues/3419#issuecomment-327777481
 *
 * @param {*} edgesTrafficList
 */
vis.Network.prototype.animateTraffic = function ({ edgesTrafficList, animationDuration = 1500 }) {
    const network = this // The current Network instance
    const trafficCanvas = getNetworkTrafficCanvas(network)

    const ctx = trafficCanvas.getContext('2d')

    var s = network.getScale() // edgeTraffic.edge.body.view.scale;
    var t = network.body.view.translation //edgeTraffic.edge.body.view.translation;

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(t.x, t.y)
    ctx.scale(s, s)

    animate(ctx, network, edgesTrafficList, animationDuration)
}

/**
 * Gets the existing networkTrafficCanvas and creates one on the DOM if it doesn't exist
 * @param {*} network
 * @returns
 */
let currentCanvas = 0
const getNetworkTrafficCanvas = (network) => {
    let trafficCanvas =
        network.body.container.getElementsByClassName('networkTrafficCanvas')[currentCanvas]
    currentCanvas = currentCanvas + (1 % 2)

    if (trafficCanvas === undefined) {
        var frame = network.canvas.frame
        trafficCanvas = document.createElement('canvas')
        trafficCanvas.className = 'networkTrafficCanvas'
        trafficCanvas.style.position = 'absolute'
        trafficCanvas.style.top = trafficCanvas.style.left = 0
        trafficCanvas.style.pointerEvents = 'none'
        trafficCanvas.style.width = frame.style.width
        trafficCanvas.style.height = frame.style.height
        trafficCanvas.width = frame.canvas.clientWidth
        trafficCanvas.height = frame.canvas.clientHeight

        frame.appendChild(trafficCanvas)
    }

    return trafficCanvas
}

/**
 * Clears the current networkTrafficCanvas
 * @param {*} ctx Canvas context
 */
const clearAnimationCanvas = (ctx) => {
    const canvasWidth = ctx.canvas.width
    const canvasHeight = ctx.canvas.height

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.restore()
}

/**
 * Gets the edge from the passed in edgeTraffic param and sets some useful defaults
 * @param {*} edgeTraffic
 * @param {*} network
 * @returns
 */
const parseEdgeTraffic = (edgeTraffic, network) => {
    const edge = edgeTraffic.edge.edgeType
        ? edgeTraffic.edge
        : network.body.edges[edgeTraffic.edge.id] || network.body.edges[edgeTraffic.edge]

    return {
        delayArray:edgeTraffic.delayArray,
        edge: edge,
        trafficSize: edgeTraffic.trafficSize || 2,
        numTraffic: edgeTraffic.numTraffic || 5,
        trafficStyle: edgeTraffic.trafficStyle || {},
        delay: edgeTraffic.delay || 0,
    }
}

const animate = (ctx, network, edgesTrafficList, duration) => {
    let start
    const stopAt = 1 // Stop when the animation has been running for this much of the duration
    const reportedErrors = {} // Helps to avoid reporting the same error in multiple setTimeout events

    const drawTrafficOnEdge = (p, { trafficSize, trafficStyle }) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, parseInt(trafficSize) || 1, 0, Math.PI * 2, false)
        ctx.lineWidth = 1
        ctx.strokeWidth = 4
        ctx.strokeStyle = trafficStyle.strokeStyle ?? 'rgba(57,138,255,0.1)'
        ctx.fillStyle = trafficStyle.fillStyle ?? '#1262e3'
        ctx.fill()
        ctx.stroke()
        ctx.closePath()
    }

    const animateFrame = (timestamp) => {
        if (start === undefined) {
            start = timestamp
        }

        clearAnimationCanvas(ctx)

        const offset = (timestamp - start) / duration
        if (offset > stopAt) {
            return
        }
        const offsetInMS = (timestamp - start)

        const parsedEdgeTrafficList = edgesTrafficList.map((edgeTraffic) =>
            parseEdgeTraffic(edgeTraffic, network)
        )

        for (const edgeTraffic of parsedEdgeTrafficList) {
            if (!edgeTraffic.edge) {
                if (!reportedErrors[edgeTraffic]) {
                    console.error('No edge path defined: ', edgeTraffic)
                    reportedErrors[edgeTraffic] = true
                }
                continue
            }

            const numTraffic = edgeTraffic.numTraffic

            // Draw multiple dots so it looks like a stream
            for (let trafficIndex = 0; trafficIndex < numTraffic; trafficIndex++) {

                //let delay = edgeTraffic.delay * ((trafficIndex+1) / numTraffic)
                let delay = edgeTraffic.delayArray[trafficIndex]

                let location
                if(offsetInMS < delay){
                    location = 0
                } else if(offsetInMS > delay + 500){
                    location = stopAt
                } else {
                    location = (offsetInMS - delay) / 500
                }

                if (location === 0 || location === stopAt) continue

                var p = edgeTraffic.edge.edgeType.getPoint(location)
                drawTrafficOnEdge(p, edgeTraffic)
            }
        }

        requestAnimationFrame(animateFrame)
    }

    requestAnimationFrame(animateFrame)
}
