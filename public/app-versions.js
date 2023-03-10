const INTERVAL = 10_000

const fetchChanges = async () => {
    const appVersionsResponse = await requestWithToken('/api/app-versions')
    const appVersions = appVersionsResponse.data
    const appVersionsWithColors = await Promise.all(
        Object.keys(appVersions).map(async (appVersion) => {
            const count = appVersions[appVersion]
            const color = await stringToColour(appVersion)

            return {
                appVersion,
                count,
                color,
            }
        })
    )
    const totalNumNodes = appVersionsWithColors.reduce((acc, appVersionWithColor) => {
        return acc + appVersionWithColor.count
    }, 0)

    drawPieChart(appVersionsWithColors, totalNumNodes)
}

const stringToColour = async (str) => {
    const msgBuffer = new TextEncoder().encode(str)

    // hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)

    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer))

    // convert bytes to hex string
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return `#${hashHex.slice(0, 6)}`
}

const drawPieChart = (appVersionsWithColors, totalNumNodes) => {
    const canvas = document.getElementById('app-versions-chart')
    const ctx = canvas.getContext('2d')

    let currentAngle = 0
    const radius = 200

    appVersionsWithColors.forEach((appVersionWithColor) => {
        const { count, color, appVersion } = appVersionWithColor
        const portionAngle = (count / totalNumNodes) * 2 * Math.PI
        ctx.beginPath()

        ctx.arc(
            canvas.width / 2,
            canvas.height / 2,
            radius,
            currentAngle,
            currentAngle + portionAngle
        )

        ctx.lineTo(radius, radius)

        ctx.fillStyle = color
        ctx.fill()

        const labelX = canvas.width / 2 + (radius / 2) * Math.cos(currentAngle + portionAngle / 2)
        const labelY = canvas.height / 2 + (radius / 2) * Math.sin(currentAngle + portionAngle / 2)
        const percentage = Math.round((100 * count) / totalNumNodes)

        ctx.fillStyle = 'white'
        ctx.font = '20px Khand'
        ctx.fillText(`v${appVersion} - ${percentage}%`, labelX, labelY)

        currentAngle += portionAngle
    })
}

fetchChanges()
setInterval(fetchChanges, INTERVAL)
