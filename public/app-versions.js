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

// From https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
const stringToColour = async (str) => {
    var hash = 0
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    var color = '#'
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xff
        color += ('00' + value.toString(16)).substr(-2)
    }
    console.log('colour', color)
    return color
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
