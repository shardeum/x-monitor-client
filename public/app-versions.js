const INTERVAL = 10_000
const colors = ["#36a2eb", "#ff6384", "#4bc0c0", "#ff9f40", "#9966ff", "#ffcd56", "#c9cbcf"]

const fetchChanges = async (animate = false) => {
    const data = []
    const labels = []
    const tooltips = []

    const appDataResponse = await requestWithToken(`${monitorServerUrl}/app-versions`)
    const appDataList = appDataResponse.data

    for(const appVersion in appDataList) {
        const count = appDataList[appVersion].nodeCount
        data.push(count)
        labels.push(appVersion)
        const cliVersions = Object.entries(appDataList[appVersion].cliVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        const guiVersions = Object.entries(appDataList[appVersion].guiVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        tooltips.push(`cliVersions:\n${cliVersions}\nguiVersions:\n${guiVersions}`)
    }

    drawPieChart(data, labels, tooltips, animate)
    writeInfoPanel(data, labels)
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

const drawPieChart = (data, labels, tooltips, animate) => {
  let chartStatus = Chart.getChart("app-versions-chart"); // <canvas> id
  if (chartStatus != undefined) {
    chartStatus.destroy();
  }

  const canvas = document.getElementById("app-versions-chart");
  const ctx = canvas.getContext("2d");

  const chartOptions = {
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

  if(!animate) {
    chartOptions.animation = false
  }


  new Chart(ctx, {
    type: "pie",
    data: {
    datasets: [{
        data: data,
        backgroundColor: colors,
    }],
    labels: labels,
    },
    options: chartOptions
  });
}

const writeInfoPanel = (data, labels) => {
    // Print total number of nodes for each version along with percentage
    const total = data.reduce((a, b) => a + b, 0)
    const infoPanel = document.getElementById("app-versions-info")
    infoPanel.innerHTML = ""
    for (let i = 0; i < data.length; i++) {
        const percentage = Math.round((data[i] / total) * 100)
        const color = stringToColour(labels[i])
        infoPanel.innerHTML += `
        <div>
            <span style="display: inline-block; width: 12px; height: 12px; background-color: ${colors[i]};"></span>
            <span style="font-weight: bold;">${labels[i]}:</span> ${data[i]} (${percentage}%)
        </div>
        `;
    }
}

fetchChanges(true)
setInterval(fetchChanges, INTERVAL)
