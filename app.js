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

let { tween, styler, listen, pointer } = popmotion

let NetworkMonitor = function() {

    let nodes = {
        requests: [],
        syncing: [],
        active: []
    }

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
                    let degree = Math.random() * 360
                    let radian = degree *  Math.PI / 180;
                    let x = R * Math.cos(radian) + X
                    let y = R * Math.sin(radian) + Y
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
                } else if (newNode.status === 'syncing') {
                    let circleStyler = styler(newNode.circle)
                    newNode.status = 'active'
                    console.log(newNode)
                    tween({
                        from: { fill: '#f9cb35' },
                        to: { fill: '#4caf50' },
                        duration: 500,
                    }).start(circleStyler.set)
                }
            })
            nodes.requests.push(newNode)
        })
        
        $('#networkCircle').addEventListener('click', e => {
            e.stopImmediatePropagation()
            console.log('clicked on network circle')
        })
    }

    const createNewNode = function(type, position) {
        switch(type) {
            case "request":
                let circleId = drawCircle(position, "30px", "gray", "2px")
                let circle = $(`#${circleId}`)
                let node = {
                    circle: circle,
                    circleId: circleId,
                    status: 'request'
                }
                return node
        }
    }

    const drawCircle = function(position, radius, fill, stroke) {
        let circleId = `abc${Date.now()}xyz`
        console.log(position)
        let circleSVG = `<circle cx="${position.x}" cy="${position.y}" r="${radius}" stroke="#eeeeee" stroke-width="${stroke}" fill="${fill}" id="${circleId}" class="request-node"/>`
        $('.background').insertAdjacentHTML('beforeend', circleSVG)
        return circleId
    }

    init()
}


