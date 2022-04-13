/* let _gatewayConnected = false,
    _gatewayPromises = {},
    _gatewayWebsocket = null


const _gatewayInit = () => {
    _gatewayWebsocket = new WebSocket(SEWOLI_CONFIG.SERVER)

    _gatewayWebsocket.onopen = () => {
        _gatewayConnected = true

        console.log('CONNECTED')

        _auth()
    }

    _gatewayWebsocket.onclose = () => {
        _gatewayConnected = false
        setTimeout(_gatewayInit, 1000)
    }

    _gatewayWebsocket.onmessage = message => {

        const json = JSON.parse(message.data)

        console.log('JSON', json)

        if(json && _gatewayPromises[json.promiseId]) {
            _gatewayPromises[json.promiseId][json.err ? 'reject' : 'resolve'](json.err ? json.err :json.res)
        } else {

            // TODO: Nachdem auth umgesetzt wurde
            / * switch(json.action) {
                case 'updateAuth':
                    swsServer.auth.updateAuth(json.user, json.jwt, true, true)
                    break;
                case 'syncToClient':
                    swsServer.db.__syncToClient(json.col, json.objects)
                    break;
                case 'updateTeams':
                    swsServer.auth.updateTeams(json.team, true)
                    break;
            } * /
        }
    } 

    _gatewayWebsocket.onerror = err => {
        console.log('GATEWAY ERROR', err)
    }
}


if(typeof SEWOLI_CONFIG.SERVER != 'undefined') {
    _gatewayInit()
}


const gatewaySend = json => {
    json.promiseId = Math.floor(Math.random() * 1000000000000)

    return new Promise((resolve, reject) => {
        _gatewayPromises[json.promiseId] = {
            resolve,
            reject
        }

        if(_gatewayConnected) {
            _gatewayWebsocket.send(JSON.stringify(json))
        } else {
            reject({
                code: 'not-connected'
            })
        }
    })
}*/