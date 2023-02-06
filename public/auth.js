var request = axios.default
const url = new URL(window.location.href)

const server = url.searchParams.get('server') || window.location.href
// var monitorServerUrl = server.slice(-1) === '/' ? server + 'api' : server + '/api'
var monitorServerUrl = `http://54.93.204.116:3000/api`

console.log('monitor server url', monitorServerUrl)

function redirectToSignIn() {
    // location.href = 'signin'
}

async function requestWithToken(url) {
    console.log('requesting with token', url)
    let token = loadToken()
    const options = {
        headers: {
            'Authorization': `${token}`
        }
    }
    const res = await request.get(url, options)
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

    let res = await request.get(`${monitorServerUrl}/status`)
    let env = res.data.env

    if (env === 'production' && !token) {
        console.log('You are not sign in yet...')
        console.log(window)
        if (window.location.pathname !== '/signin') setTimeout(redirectToSignIn, 500)
        return
    }

    if (env === 'production' && token != null) {
        try {
            let response = await request.get(`${monitorServerUrl}/report`, {
                headers: {
                    'Authorization': `${token}`
                }
            })
            if (response.data) {
                console.log('Your token is valid')
            }
        } catch (e) {
            console.log('You have invalid token')
            if (window.location.pathname !== '/signin') setTimeout(redirectToSignIn, 500)
            return
        }
    }
}

checkAuthRequirement()
