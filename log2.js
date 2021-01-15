const server = document.querySelector('#server') || 'http://localhost:3334'

const socket = io(server)
socket.on('connection', async () => {
  console.log('connected')
})
socket.on('connect', async () => {
  console.log(`Connected as ${socket.id}`)
  Vue.component('v-select', VueSelect.VueSelect)
  new Vue({
    el: '#app',
    data: {
      files: [],
      file: '',
      size: 0,
      start: 0,
      end: 0,
      min: 0,
      max: 0,
      slider: null,
      fileContent: '',
      emptyFileMessage: 'List files in the directory',
      tail: false,
    },
    methods: {
      async onListFiles() {
        console.log('list...')
        const files = await asyncEmit('list')
        this.files = [...files]
        this.emptyFileMessage = 'Pls select a file from the list.'
      },
      async onSelectFile(file) {
        // Close currently open file
        if (this.file) {
          await this.onCloseFile()
        }

        // Open new file and set max and end based on its size
        this.file = file
        console.log(`open ${this.file}...`)
        this.size = await asyncEmit('open', this.file)
        this.min = 0
        this.max = this.size
        this.start = 0
        this.end = 100 > this.size ? this.size : 100

        // Initialize slider
        const opts = {
          skin: 'flat',
          type: 'double',
          min: this.min,
          max: this.max,
          from: this.start,
          to: this.end,
          grid: true,
          drag_interval: true,
          onChange: async (data) => {
            this.start = data.from
            this.end = data.to
            // console.log([this.start, this.end])
            await this.onReadFile()
          },
        }
        if (this.slider) {
          this.slider.update(opts)
        } else {
          $('.js-range-slider').ionRangeSlider(opts)
          this.slider = $('.js-range-slider').data('ionRangeSlider')
        }

        // Enable zoom with mouse wheel
        const sliderDiv = document.getElementById('slider')
        if (!sliderDiv.onwheel) {
          sliderDiv.onwheel = (ev) => {
            if (ev.deltaY < 0) {
              // zoom in
              this.min = Math.ceil(Math.max(this.min, 1) * (1 + 0.1))
              this.max = Math.ceil(Math.max(this.max, 1) * (1 - 0.1))
            } else {
              // zoom out
              this.min = parseInt(Math.max(this.min, 1) * (1 - 0.1))
              this.max = parseInt(Math.max(this.max, 1) * (1 + 0.1))
            }
            if (this.max < this.end) this.max = this.end
            if (this.min > this.start) this.min = this.start
            if (this.max > this.size) this.max = this.size
            if (this.min < 0) this.min = 0
            // console.log(['start', this.start, 'end', this.end])
            // console.log(['min', this.min, 'max', this.max])
            this.slider.update({
              min: this.min,
              max: this.max,
            })
          }
        }

        await this.onReadFile()
      },
      async onReadFile() {
        this.fileContent = ''
        console.log(`read ${this.start} ${this.end}...`)
        const contents = await asyncEmit('read', this.start, this.end)
        this.fileContent = arrayBufferToString(contents)
      },
      async onCloseFile() {
        console.log(`close ${this.file}...`)
        const closed = await asyncEmit('close')
        console.log(closed)
      },
      async toggleTailFile() {
        this.tail = !this.tail
        if (this.tail) this.startTailingFile()
        else this.stopTailingFile()
      },
      async startTailingFile() {
        // Listen for 'change' events
        socket.on('change', async (newSize) => {
          // Update size
          this.size = newSize
          // Move slider to the end
          const selectionSize = this.end - this.start
          const viewportSize = this.max - this.min
          this.max = this.size
          this.min = this.max - viewportSize
          this.end = this.max
          this.start = this.end - selectionSize
          this.slider.update({
            min: this.min,
            max: this.max,
            from: this.start,
            to: this.end,
          })
          // Read bytes
          await this.onReadFile()
        })
      },
      async stopTailingFile() {
        socket.off('change')
      },
    },
    async mounted() {
      await this.onListFiles()
    },
  })
})

function asyncEmit(ev, ...args) {
  return new Promise((resolve) => {
    socket.emit(ev, ...args, (response) => {
      resolve(response)
    })
  })
}

function arrayBufferToString(buffer) {
  let bufView = new Uint8Array(buffer)
  let length = bufView.length
  let result = ''
  let addition = Math.pow(2, 16) - 1
  for (let i = 0; i < length; i += addition) {
    if (i + addition > length) {
      addition = length - i
    }
    result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition))
  }
  return result
}
