let connection
let currentSubscribedLog
let logOutput = document.querySelector('#log-output-container')
let searchResultContainer = document.querySelector('#search-output-container')

new Vue({
  el: '#app',
  data: {
    ip: null,
    port: null
  },
  mounted: function () {
    console.log('mounted')
    const urlParams = new URLSearchParams(window.location.search)
    let ip = urlParams.get('ip')
      if (ip === 'localhost' || ip === '127.0.0.1') {
          ip = window.location.href.split('//')[1].split(":")[0]
      }
      console.log('ip', ip)
      this.ip = ip
    this.port = urlParams.get('port')
  },
  methods: {
    onClickSubscribe (e, slotId) {
      console.log('slotID', slotId)
      e.preventDefault()
      this.subscribeLogs(slotId)
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
