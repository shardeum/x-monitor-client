const INTERVAL = 10_000

const fetchChanges = async () => {
    const data = []
    const labels = []
    const tooltips = []

    const appDataResponse = await requestWithToken('/api/app-versions')
    const appDataList = appDataResponse.data

    for(const appVersion in appDataList) {
        const count = appDataList[appVersion].nodeCount
        data.push(count)
        labels.push(appVersion)
        const cliVersions = Object.entries(appDataList[appVersion].cliVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        const guiVersions = Object.entries(appDataList[appVersion].guiVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        tooltips.push(`cliVersions:\n${cliVersions}\nguiVersions:\n${guiVersions}`)
    }

    drawPieChart(data, labels, tooltips)
}

// From https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
const stringToColour = (str) => {
    var hash = 0
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    var color = '#'
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xff
        color += ('00' + value.toString(16)).substring(-2)
    }
    console.log('colour', color)
    return color
}

const drawPieChart = (data, labels, tooltips) => {
  let chartStatus = Chart.getChart("app-versions-chart"); // <canvas> id
  if (chartStatus != undefined) {
    chartStatus.destroy();
  }

  const canvas = document.getElementById("app-versions-chart");
  const ctx = canvas.getContext("2d");

  new Chart(ctx, {
    type: "pie",
    data: {
    datasets: [{
        data: data,
    }],
    labels: labels,
    },
    options: {
        plugins: {
            tooltip: {
                callbacks: {
                    afterBody: (context) => {
                        return tooltips[context[0].dataIndex].split("\n")
                    }
                }

            }
        }
    }
  });
}

fetchChanges()
setInterval(fetchChanges, INTERVAL)
