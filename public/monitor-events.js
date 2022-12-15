const INTERVAL = 10_000

const fetchChanges = async () => {
    const countedEventsResponse = await requestWithToken('/api/counted-events')
    const countedEvents = countedEventsResponse.data

    countedEvents.forEach((countedEvent) => {
        const eventCategoryEl = createOrGetEventCategoryElement(countedEvent.eventCategory)
        const eventNameEl = createOrGetEventNameElement(eventCategoryEl, countedEvent.eventName)
        createOrGetEventCountElement(eventNameEl, countedEvent.eventCount)
        const nodesListEl = createOrGetNodesList(eventNameEl)
        const eventMessagesListEl = createOrGetEventMessagesList(eventNameEl)

        for (const nodeId in countedEvent.instanceData) {
            const instanceData = countedEvent.instanceData[nodeId]
            createOrGetInstanceDataElement(nodesListEl, nodeId, instanceData)
        }

        for (const eventMessage in countedEvent.eventMessages) {
            const eventMessageCount = countedEvent.eventMessages[eventMessage]
            createOrGetEventMessageElement(eventMessagesListEl, eventMessage, eventMessageCount)
        }
    })
}

/**
 * Get a unique HTML ID for the event category
 * @param {string} eventCategory
 * @returns
 */
const eventCategoryToHTMLId = (eventCategory) => `c-${eventCategory}`

/**
 * Get a unique HTML ID for the event name. Event name has to be globally unique even
 * though it is only unique under an event category
 * @param {string} eventCategory
 * @param {string} eventName
 * @returns
 */
const eventNameToHTMLId = (eventCategory, eventName) =>
    `${eventCategoryToHTMLId(eventCategory)}-n-${eventName}`

/**
 * Gets a shorter node ID for display purposes
 * @param {string} nodeId
 */
const getTruncatedNodeId = (nodeId) => nodeId.substring(0, 10)

/**
 * HTML IDs cannot start with a number, so we use this instead of getTruncatedNodeId directly
 * @param {string} nodeId
 */
const nodeIdToHTMLId = (nodeId) => `node-${nodeId}`

const generateHash = function (num) {
    const table = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']
    let hash = ''
    for (let i = 0; i < num; i++) {
        const randomIndex = Math.floor(Math.random() * table.length)
        hash += table[randomIndex]
    }
    return hash
}

/**
 * Gets an existing event category element or creates a new one
 * @param {string} eventCategory
 * @returns
 */
const createOrGetEventCategoryElement = (eventCategory) => {
    const eventList = document.getElementById('event-list')

    const eventCategoryHTMLId = eventCategoryToHTMLId(eventCategory)
    const eventCategoryExists = document.getElementById(eventCategoryHTMLId) !== null
    const eventCategoryEl =
        document.getElementById(eventCategoryHTMLId) ?? document.createElement('details')

    if (!eventCategoryExists) {
        eventCategoryEl.id = eventCategoryHTMLId
        eventCategoryEl.innerHTML = `<summary>${eventCategory}</summary>`
        eventList.appendChild(eventCategoryEl)

        const eventNameList = document.createElement('ul')
        eventCategoryEl.appendChild(eventNameList)
    }

    return eventCategoryEl
}

/**
 * Gets an existing event name element or creates a new one. The event name has to only be unique
 * within the context of an event category
 * @param {HTMLElement} eventCategoryEl
 * @param {string} eventName
 */
const createOrGetEventNameElement = (eventCategoryEl, eventName) => {
    const eventNameHTMLId = eventNameToHTMLId(eventCategoryEl.id, eventName)
    const eventNameExists = eventCategoryEl.querySelector(`#${eventNameHTMLId}`) !== null
    const eventNameEl =
        eventCategoryEl.querySelector(`#${eventNameHTMLId}`) ?? document.createElement('details')

    const eventNamesList = eventCategoryEl.querySelector('ul')

    if (!eventNameExists) {
        eventNameEl.id = eventNameHTMLId
        eventNameEl.innerHTML = `<summary>${eventName}</summary>`
        eventNamesList.appendChild(eventNameEl)

        const eventsList = document.createElement('ul')
        eventNameEl.appendChild(eventsList)
    }

    return eventNameEl.querySelector('ul')
}

/**
 * Gets an existing event count element or create a new one if it doesn't exist under the event name
 * @param {HTMLElement} eventNameEl
 * @param {number} eventCount
 */
const createOrGetEventCountElement = (eventNameEl, eventCount) => {
    const eventCountHTMLId = 'event-count'
    const eventCountExists = eventNameEl.querySelector(`#${eventCountHTMLId}`) !== null
    const eventCountEl =
        eventNameEl.querySelector(`#${eventCountHTMLId}`) ?? document.createElement('div')

    eventCountEl.id = eventCountHTMLId
    eventCountEl.textContent = `Event count: ${eventCount}`

    if (!eventCountExists) {
        eventNameEl.appendChild(eventCountEl)
    }
}

/**
 * Gets an existing nodes list element if it exists or create a new one and return it
 * @param {HTMLElement} eventNameEl
 * @returns
 */
const createOrGetNodesList = (eventNameEl) => {
    const eventNodesListHTMLId = 'nodes-list'
    const eventNodesListExists = eventNameEl.querySelector(`#${eventNodesListHTMLId}`) !== null
    const eventNodesListEl =
        eventNameEl.querySelector(`#${eventNodesListHTMLId}`) ?? document.createElement('details')

    if (!eventNodesListExists) {
        eventNodesListEl.innerHTML = `<summary>Nodes</summary>`
        eventNodesListEl.id = eventNodesListHTMLId

        const nodesList = document.createElement('ul')
        eventNodesListEl.appendChild(nodesList)

        eventNameEl.appendChild(eventNodesListEl)
    }

    return eventNodesListEl.querySelector('ul')
}

/**
 * Get an existing shardus node instance by ID or create an HTML node for it if it doesn't exist
 * @param {HTMLElement} nodesListEl
 * @param {string} nodeId
 * @param {{eventCount: number, externalIp: string, externalPort: number}} instanceData
 */
const createOrGetInstanceDataElement = (nodesListEl, nodeId, instanceData) => {
    const { eventCount, externalIp, externalPort } = instanceData

    const truncatedNodeId = getTruncatedNodeId(nodeId)
    const nodeHTMLId = nodeIdToHTMLId(truncatedNodeId)
    const nodeExists = nodesListEl.querySelector(`#${nodeHTMLId}`) !== null
    const nodeEl = nodesListEl.querySelector(`#${nodeHTMLId}`) ?? document.createElement('div')

    nodeEl.id = nodeHTMLId
    const href = `/log?ip=${externalIp}&port=${externalPort}`
    nodeEl.innerHTML = `
        Count for 
        <a href="${href}" target="_blank" rel="noopener noreferrer">
            ${truncatedNodeId}
        </a>: 
        ${eventCount}
    `

    if (!nodeExists) {
        nodesListEl.appendChild(nodeEl)

        nodeEl.classList.add('node')
    }
}

/**
 * Gets an existing event messages list element if it exists or create a new one and return it
 * @param {HTMLElement} eventNameEl
 * @returns
 */
const createOrGetEventMessagesList = (eventNameEl) => {
    const eventMessagesListHTMLId = 'event-messages-list'
    const eventMessagesListExists =
        eventNameEl.querySelector(`#${eventMessagesListHTMLId}`) !== null
    const eventMessagesListEl =
        eventNameEl.querySelector(`#${eventMessagesListHTMLId}`) ??
        document.createElement('details')

    if (!eventMessagesListExists) {
        eventMessagesListEl.innerHTML = `<summary>Event Messages</summary>`
        eventMessagesListEl.id = eventMessagesListHTMLId

        const messagesList = document.createElement('ul')
        eventMessagesListEl.appendChild(messagesList)

        eventNameEl.appendChild(eventMessagesListEl)
    }

    return eventMessagesListEl.querySelector('ul')
}

/**
 * Get an existing event message element or create it if it doesn't exist for the current
 * event category and event name
 * @param {HTMLElement} eventMessagesList
 * @param {string} eventMessage
 * @param {number} eventMessageCount
 */
const createOrGetEventMessageElement = (eventMessagesList, eventMessage, eventMessageCount) => {
    const eventMessageHTMLId = 'message' + generateHash(10)
    const eventMessageExists = eventMessagesList.querySelector(`#${eventMessageHTMLId}`) !== null
    const eventMessageEl =
        eventMessagesList.querySelector(`#${eventMessageHTMLId}`) ?? document.createElement('div')

    eventMessageEl.id = eventMessageHTMLId
    eventMessageEl.textContent = `Message: "${eventMessage}". Count: ${eventMessageCount}`

    if (!eventMessageExists) {
        eventMessagesList.appendChild(eventMessageEl)
    }
}

/**
 * Filter the rendered nodes by a searched nodeId
 * @param {Event} input
 */
const filterByNodesId = (input) => {
    const searchString = input.target.value
    const truncatedSearchString = getTruncatedNodeId(searchString)

    const allNodes = document.querySelectorAll('.node')
    allNodes.forEach((node) => {
        // Remove "node-" prefix
        const nodeId = node.id.substring(5)
        node.classList.remove('hidden')

        const nodeContainsSearchString = nodeId.startsWith(truncatedSearchString)

        if (!nodeContainsSearchString) {
            node.classList.add('hidden')
        }
    })
}

fetchChanges()
setInterval(fetchChanges, INTERVAL)
