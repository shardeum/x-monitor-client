var request = axios.default
new Vue({
    el: '#app',
    data: {
        username: 'admin',
        password: 'password'
    },
    mounted: function () {
        console.log('mounted')
    },
    methods: {
        async onSubmit(e, slotId) {
            console.log('slotID', slotId)
            e.preventDefault()
            await this.signIn({
                username: this.username,
                password: this.password
            })
        },
        async signIn(payload) {
            const res = await request.post(`${monitorServerUrl}/signin`, payload)
            if (res.data && res.data.token) {
                console.log('SingIn Successful', res.data.token)
                localStorage.setItem('token', res.data.token)
                location.href = "/"
            } else {
                alert('Incorrect username or password')
                this.username = ''
                this.password = ''
            }
        }
    }
})
