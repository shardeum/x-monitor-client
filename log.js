let connection
let currentSubscribedLog
let logOutput = document.querySelector('#log-output-container')
let searchResultContainer = document.querySelector('#search-output-container')

new Vue({
  el: '#app',
  data: {
    searchResult: '',
    slots: {
      1: {
        filename: 'out',
        port: '9001',
        isSubscribed: false,
        output: ''
      },
      // 2: {
      //   filename: 'out',
      //   port: '9002',
      //   isSubscribed: false,
      //   output: ''
      // },
      // 3: {
      //   filename: 'out',
      //   port: '9003',
      //   isSubscribed: false,
      //   output: ''
      // },
      // 4: {
      //   filename: 'out',
      //   port: '9004',
      //   isSubscribed: false,
      //   output: ''
      // }
    }
  },
  mounted: function () {
    console.log('mounted')
    const urlParams = new URLSearchParams(window.location.search)
    const hostname = window.location.hostname
    const port = urlParams.get('port')
    console.log('socket host', hostname)
    this.connectToLogServer(`ws://${hostname}:8080`)
  },
  methods: {
    connectToLogServer (url) {
      let self = this
      connection = new WebSocket(url)
      connection.onopen = () => {
        console.log('Connected to log-server')
        const urlParams = new URLSearchParams(window.location.search)
        const port = urlParams.get('port')
        if (port) {
          self.slots[1].port = port
          self.subscribeLogs(1)
        }
      }
    },
    subscribeLogs (slotId) {
      console.log('Subscribing logs from', this.slots[slotId].filename)
      let self = this
      this.slots[slotId].output = ''
      connection.send(
        JSON.stringify({
          node: {
            port: this.slots[slotId].port,
            filename: this.slots[slotId].filename
          },
          slot: slotId
        })
      )
      this.slots[slotId].isSubscribed = true
      connection.onmessage = e => {
        let message = JSON.parse(e.data)
        this.slots[message.slot].output += message.data
        setTimeout(() => {
          self.scrollToLastLine(message.slot)
        }, 500)

        if (this.slots[message.slot].output.length > 5000) {
          console.log('Trimming output string')
          this.slots[message.slot].output = this.slots[
            message.slot
          ].output.substr(5000)
        }
      }
    },
    onClickSubscribe (e, slotId) {
      console.log('slotID', slotId)
      e.preventDefault()
      this.subscribeLogs(slotId)
    },
    async searchInLogs (search, filename) {
      if (!filename) {
        alert('Subscribe to a log file first')
        return
      }
      if (!search) {
        alert('Search String cannot be empth')
        return
      }
      const url = `http://localhost:8081/logs?filename=${filename}&search=${search}`
      console.log(url)
      clearSearchResults()
      try {
        const res = await fetch(url)
        let json = await res.json()
        console.log(json)
        if (json.length > 0) {
          searchResultContainer.innerHTML += `${json.length} Results Found`
          for (let item of json) {
            searchResultContainer.innerHTML += `<p>${item}</p>`
          }
        } else {
          searchResultContainer.innerHTML = `0 Result Found`
        }
      } catch (e) {
        searchResultContainer.innerHTML = `0 Result Found`
      }
    },
    clearSearchResults () {
      searchResultContainer.innerHTML = ''
    },
    scrollToLastLine (slotId) {
      let textArea = document.getElementById(`output-${slotId}`)
      textArea.scrollTop = textArea.scrollHeight
    }
  }
})
