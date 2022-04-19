const socket = io()
socket.on('connection', async () => {
    console.log('connection is made')
})

new Vue({
    el: '#app',
    data: {
        fileContent: ''
    },
    async mounted() {
        socket.on('connect', async () => {
            console.log(`Connected as ${socket.id}`)
        })
        socket.on('old-data', async (data) => {
            this.fileContent += `${data}\n`
            socket.emit('message', 'let get started')
        })
        socket.on('new-history-log', async (data) => {
            this.fileContent += `${data}\n`
        })
    }
})
