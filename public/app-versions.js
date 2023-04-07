const INTERVAL = 10_000

const fetchChanges = async () => {
    const data = []
    const labels = []
    const tooltips = new Map()

    const appDataResponse = await requestWithToken('/api/app-versions')
    const appDataList = appDataResponse.data

    for(const appVersion in appDataList) {
        const count = appDataList[appVersion].nodeCount
        data.push(count)
        labels.push(appVersion)
        const cliVersions = Object.entries(appDataList[appVersion].cliVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        const guiVersions = Object.entries(appDataList[appVersion].guiVersions).map(([version, count]) => `${version}: ${count}`).join("\n");
        tooltips.set(String(count), `cliVersions:\n${cliVersions}\nguiVersions:\n${guiVersions}`)
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
                enabled: false,

                external: function(context) {
                    // Tooltip Element
                    let tooltipEl = document.getElementById('chartjs-tooltip');

                    // Create element on first render
                    if (!tooltipEl) {
                        tooltipEl = document.createElement('div');
                        tooltipEl.id = 'chartjs-tooltip';
                        tooltipEl.innerHTML = '<table></table>';
                        document.body.appendChild(tooltipEl);
                    }

                    // Hide if no tooltip
                    const tooltipModel = context.tooltip;
                    if (tooltipModel.opacity === 0) {
                        tooltipEl.style.opacity = 0;
                        return;
                    }

                    // Set caret Position
                    tooltipEl.classList.remove('above', 'below', 'no-transform');
                    if (tooltipModel.yAlign) {
                        tooltipEl.classList.add(tooltipModel.yAlign);
                    } else {
                        tooltipEl.classList.add('no-transform');
                    }

                    function getBody(bodyItem) {
                        return bodyItem.lines;
                    }

                    // Set Text
                    if (tooltipModel.body) {
                        const titleLines = tooltipModel.title || [];
                        const bodyLines = tooltipModel.body.map(getBody);

                        let innerHtml = '<thead>';

                        titleLines.forEach(function(title) {
                            innerHtml += '<tr><th>' + title + '</th></tr>';
                        });
                        innerHtml += '</thead><tbody>';

                        bodyLines.forEach(function(body, i) {
                            const colors = tooltipModel.labelColors[i];
                            let style = 'background:' + colors.backgroundColor;
                            style += '; border-color:' + colors.borderColor;
                            style += '; border-width: 2px';
                            const versions = tooltips.get(body[0])
                            const html = versions.split("\n").map(line => `<p>${line}</p>`).join("");
                            const span = '<span style="' + style + '">' + body + html + '</span>';
                            innerHtml += '<tr><td>' + span + '</td></tr>';
                            console.log(html)
                        });
                        innerHtml += '</tbody>';

                        let tableRoot = tooltipEl.querySelector('table');
                        tableRoot.innerHTML = innerHtml;
                    }

                    const position = context.chart.canvas.getBoundingClientRect();
                    const bodyFont = Chart.helpers.toFont(tooltipModel.options.bodyFont);

                    // Display, position, and set styles for font
                    tooltipEl.style.opacity = 1;
                    tooltipEl.style.position = 'absolute';
                    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                    tooltipEl.style.font = bodyFont.string;
                    tooltipEl.style.padding = tooltipModel.padding + 'px ' + tooltipModel.padding + 'px';
                    tooltipEl.style.pointerEvents = 'none';
                }
            }
        }
    }
  });
}

fetchChanges()
setInterval(fetchChanges, INTERVAL)
