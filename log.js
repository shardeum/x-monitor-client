let connection
let currentSubscribedLog
let logOutput = document.querySelector('#log-output-container')
let searchResultContainer = document.querySelector('#search-output-container')

new Vue({
  el: '#app',
  data: {
    ip: null,
    port: 9001
  },
  mounted: function () {
    console.log('mounted')
    const urlParams = new URLSearchParams(window.location.search)
    this.ip = urlParams.get('ip')
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
