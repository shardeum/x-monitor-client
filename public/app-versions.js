const INTERVAL = 10_000
const colors = ["#36a2eb", "#ff6384", "#4bc0c0", "#ff9f40", "#9966ff", "#ffcd56", "#c9cbcf"]

const fetchChanges = async (animate = false) => {
    const data = []
    const labels = []
    const tooltips = []
    const selectedNodeType = nodeTypeSelect.value; // Get the selected node type from the dropdown

    const appDataResponse = await requestWithToken(`${monitorServerUrl}/app-versions`)
    const appDataList = appDataResponse.data
    for(const appVersion in appDataList) {
        const activeNodes = appDataList[appVersion].activeNodeCount === undefined || NaN? 0 : appDataList[appVersion].activeNodeCount;
        const joiningNodes = appDataList[appVersion].joiningNodeCount  === undefined || NaN? 0 : appDataList[appVersion].joiningNodeCount;
        const syncingNodes = appDataList[appVersion].syncingNodeCount  === undefined || NaN? 0 : appDataList[appVersion].syncingNodeCount;

        const count = (activeNodes + joiningNodes) === undefined || NaN? 0 : (activeNodes + joiningNodes);
        const nodes = {
            active: activeNodes,
            joining: joiningNodes,
            syncing: syncingNodes,
            all: count
        };

        data.push(nodes);
        labels.push(appVersion)
        const cliVersions = Object.entries(appDataList[appVersion].cliVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        const guiVersions = Object.entries(appDataList[appVersion].guiVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        tooltips.push(`cliVersions:\n${cliVersions}\nguiVersions:\n${guiVersions}`)
    }

    drawPieChart(data, labels, tooltips, animate, selectedNodeType)
    writeInfoPanel(data, labels, selectedNodeType)
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

const drawPieChart = (data, labels, tooltips, animate, selectedNodeType) => {
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


  let graphType = "pie";
  let datasets;

  if (selectedNodeType === "all") {
    datasets = [
      {
        data: data.map((nodes) => nodes.all),
        backgroundColor: colors,
      },
    ];
  } else {
    datasets = [
      {
        data: data.map((nodes) => nodes[selectedNodeType]),
        backgroundColor: colors,
        label: selectedNodeType,
      },
    ];
  }

  // Check if all data values are 0
  const allZero = datasets.every((dataset) =>
    dataset.data.every((value) => value === 0)
  );

  if (allZero) {
    datasets = [
      {
        data: [1], // Add a dummy value to display an empty pie chart
        backgroundColor: ["#808080"], // Set the color to grey
        borderWidth: 0, // Remove the border
        label: "No data available",
      },
    ];
  }

  new Chart(ctx, {
    type: graphType,
    data: {
      datasets: datasets,
      labels: labels,
    },
    options: chartOptions
  });
}

const writeInfoPanel = (data, labels, selectedNodeType) => {
    const infoPanel = document.getElementById("app-versions-info");
    infoPanel.innerHTML = "";
    if (selectedNodeType === "all") {
      const totalAll = data.reduce((total, nodes) => total + nodes.all, 0); // Calculate the total count for all nodes
      for (let i = 0; i < data.length; i++) {
        const total = data[i].active + data[i].joining + data[i].syncing;
        const percentage = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0; // Calculate the percentage for each node version
        // eslint-disable-next-line no-unsanitized/property
        infoPanel.innerHTML += `
          <div>
            <span style="display: inline-block; width: 12px; height: 12px; background-color: ${colors[i]};"></span>
            <span style="font-weight: bold;">${labels[i]}:</span> ${total} (${percentage}%)
          </div>
        `;
      }
    } else {
      const total = data.reduce((total, nodes) => total + nodes[selectedNodeType], 0);
      for (let i = 0; i < data.length; i++) {
        const percentage = total > 0 ? Math.round((data[i][selectedNodeType] / total) * 100) : 0;
        // eslint-disable-next-line no-unsanitized/property
        infoPanel.innerHTML += `
          <div>
            <span style="display: inline-block; width: 12px; height: 12px; background-color: ${colors[i]};"></span>
            <span style="font-weight: bold;">${labels[i]}:</span> ${data[i][selectedNodeType]} (${percentage}%)
          </div>
        `;
      }
    }
  };

const nodeTypeSelect = document.getElementById("node-type");
nodeTypeSelect.addEventListener("change", () => {
  fetchChanges(true);
});

fetchChanges(true)
setInterval(fetchChanges, INTERVAL)
