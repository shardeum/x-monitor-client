
async function getVersionNumbers() {
    const versionResponse = await requestWithToken(`${monitorServerUrl}/version`)

    clientVersion = versionResponse.clientPackageVersion
    serverVersion = versionResponse.serverPackageVersion

    document.getElementById("client-version").textContent = clientVersion
    document.getElementById("server-version").textContent = serverVersion
}

getVersionNumbers()


console.log("inside")



