function redirectToSignIn() {
    location.href = 'signin'
}

async function requestWithToken(url) {
    console.log('requesting with token', url)
    let token = loadToken()
    const options = {
        headers: {
            'Authorization': `${token}`
        }
    }
    const res = await axios.get(url, options)
    return res
}

function loadToken(G) {
    let token = localStorage.getItem('token')
    if (G) G.token = token
    console.log('Token is set to', token)
    return token
}

async function checkAuthRequirement() {
    console.log('Checking auth requirement...')
    let token = localStorage.getItem('token')

    let res = await axios.get('/api/status')
    let env = res.data.env

    if (env === 'production' && !token) {
        console.log('You are not sign in yet...')
        setTimeout(redirectToSignIn, 500)
        return
    }

    if (env === 'production' && token != null) {
        try {
            let response = await axios.get('/api/report', {
                headers: {
                    'Authorization': `${token}`
                }
            })
            if (response.data) {
                console.log('Your token is valid')
            }
        } catch (e) {
            console.log('You have invalid token')
            setTimeout(redirectToSignIn, 500)
            return
        }
    }
}

checkAuthRequirement()
