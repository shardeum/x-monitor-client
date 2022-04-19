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
        onSubmit(e, slotId) {
            console.log('slotID', slotId)
            e.preventDefault()
            this.signIn({
                username: this.username,
                password: this.password
            })
        },
        async signIn(payload) {
            const res = await axios.post('/api/signin', payload)
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
