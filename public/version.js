
async function getVersionNumbers() {
    const versionResponse = await requestWithToken(`${monitorServerUrl}/version`)

    console.log("test string:", versionResponse.data)
    clientVersion = versionResponse.data.clientPackageVersion
    serverVersion = versionResponse.data.serverPackageVersion

    document.getElementById("client-version").textContent = clientVersion
    document.getElementById("server-version").textContent = serverVersion
}

getVersionNumbers()


console.log("inside")
//console.log("versionReponse: ", versionResponse)
//console.log(clientVersion)
//console.log(serverVersion)



