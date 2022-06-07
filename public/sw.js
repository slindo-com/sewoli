self.addEventListener('install', () =>
    console.log('SEWOLI INSTALLED')
)

self.addEventListener('activate', async () => {
    _activateWebserver()
})

self.addEventListener('fetch', async e => 
    _fetchListener(e)
);let _hasAuth = false


const _authInit = async () => {
    const jwt = await keyValueGet('jwt')

    if(jwt) {
        gatewaySend({
            action: 'auth',
            jwt
        }).then(res => {
            console.log(jwt, true)
            _hasAuth = true
        }).catch(err => {
            _hasAuth = false
        })
    } else {
        _hasAuth = false
    }
}


const signUp = async ({ email, password }) =>
    new Promise((resolve, reject) => {
        gatewaySend({
            action: 'sign-up',
            email,
            password
        }).then(res => {
            resolve(res)
        }).catch(reject)
    })


const signIn = async ({ email, password }) =>
    new Promise((resolve, reject) => {
        gatewaySend({
            action: 'sign-in',
            email,
            password
        }).then(res => {
            keyValueSet('jwt', res.jwt)
            resolve(res)
        }).catch(reject)
    })


const signOut = async () =>
    new Promise(async (resolve, reject) => {

        const jwt = await keyValueGet('jwt')

        gatewaySend({
            action: 'sign-out',
            jwt
        }).then(async res => {
            // TODO: clear database
            await keyValueSet('jwt', '')
            resolve(res)
        }).catch(reject)
    })


const sendPasswordMail = ({ email }) => {

}


const hasAuth = () => _hasAuth;let _storesConnection

let _storesObjectStores = {} // stores onjectStores of the indexedDB
let _storesStores = {} // stores the stores received from the sewoli class

let _storesDatabase // the indexedDB instance

let _storesModels

const _storesQueueModel = {
    type: '_queue',
    attributes: {
        action: '',
        content: '',
        created_at: '' // TODO: Add always?
    }
}


const _storesCreateIndex = (objStore, title, index) => 
    objStore.createIndex(title, index, { unique: false })

const _databaseInit = () => {
	_storesModels = SEWOLI_CONFIG.DATABASE.MODELS
	_storesModels.push(_storesQueueModel)

	_storesConnection = indexedDB.open('db', SEWOLI_CONFIG.DATABASE.ITERATION)

	_storesConnection.onupgradeneeded = () => {
		_storesDatabase = _storesConnection.result
	
		_storesModels.forEach(model => {
			_storesObjectStores[model.type] = _storesDatabase.createObjectStore(model.type, { keyPath: 'id' })
			_storesCreateIndex(_storesObjectStores[model.type], 'isDeleted', 'isDeleted')
			_storesCreateIndex(_storesObjectStores[model.type], 'toSync', 'toSync')
	
			if (model.indexes) {
				model.indexes.forEach(indexData => _storesCreateIndex(_storesObjectStores[model.type], indexData.title, indexData.index))
			}
	
			// TODO: we don't need this (why?)
			_storesStores[model.type] = new _storesStoreClass({
				store: model.type,
				model: model.attributes
			})
		})
	
		_storesDatabase.createObjectStore('keyvalue')
	}
	
	
	_storesConnection.onsuccess = e => {
		_storesDatabase = e.target.result
	
		_storesModels.forEach(model => {
			_storesStores[model.type] = new _storesStoreClass({
				store: model.type,
				model: model.attributes
			})
		})
	}
	
	_storesConnection.onerror = e => {
		console.log('DATABASE ERROR', e)
	}
}

const getStore = id => _storesStores[id]

const _storesGetId = () => 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000)



const keyValueSet = async (key, val) =>
    new Promise((resolve, reject) => {
        const req = _storesDatabase.transaction('keyvalue', 'readwrite').objectStore('keyvalue').put(val, key)
        req.onerror = e => reject(e)
        req.onsuccess = e => resolve(e)
    })

const keyValueGet = async key =>
	new Promise((resolve, reject) => {
		const req = _storesDatabase.transaction('keyvalue', 'readonly').objectStore('keyvalue').get(key)
		req.onerror = e => reject(e)
		req.onsuccess = e => resolve(req.result)
	})




class _storesStoreClass {


	constructor({ store, model }) {
		this.store = store
		this.model = model
	}


	async _queuePut (action, content) {
		var asset = JSON.parse(JSON.stringify(_storesQueueModel.attributes))
		asset.id = _storesGetId();
		asset.store = this.store
		asset.action = action
		asset.content = content

		return await this._put('_queue', asset)
	}


	async _queueSyncInternal (id) {
		const asset = await this._get('_queue', id)
		if(asset.action === 'C' || asset.action === 'U') {
			return this._syncIn(asset.store, asset.content)
		} else if(asset.action === 'D') {
			return this._delete(asset.store, asset.content.id)
		}
	}


    // TODO: put next three functions in one
	async _get (store, id) {
		return new Promise((resolve, reject) => {
			const req = _storesDatabase.transaction(store, 'readonly').objectStore(store).get(id)
			req.onerror = e => reject(e)
			req.onsuccess = e => (req.result) ? resolve(req.result) : resolve(null)
		});
	}


	async _put(store, asset) {
		return new Promise((resolve, reject) => {
			const req = _storesDatabase.transaction(store, 'readwrite').objectStore(store).put(asset)
			req.onsuccess = e => resolve(asset)
			req.onerror = err => reject(err)
		})
	}


	async _delete(store, id) {
		return new Promise((resolve, reject) => {
			const req = _storesDatabase.transaction(store, 'readwrite').objectStore(store).delete(id)
			req.onsuccess = e => resolve()
			req.onerror = err => reject(err)
		})
	}


	async _syncIn (store, content) {
		const assetInDB = await this._get(this.store, content.id)

		if(!assetInDB) {
			await this._put(this.store, content)
		} else {
			Object.keys(content).forEach(key => assetInDB[key] = content[key])
			await this._put(this.store, assetInDB)
		}
		return true
	}


	async new (assetAttributes) {

		var asset = JSON.parse(JSON.stringify(this.model))

		Object.keys(assetAttributes).forEach(key => asset[key] = assetAttributes[key])

		asset.id = _storesGetId()

		const queueAsset = await this._queuePut('C', asset)
		await this._queueSyncInternal(queueAsset.id)

		return asset
	}


	async get (id) {
		return this._get(this.store, id)
	}


	async getAll() {
		return new Promise((resolve, reject) => {

			var assets = []

			const req = _storesDatabase.transaction(this.store, 'readonly').objectStore(this.store).openCursor()

			req.onerror = err => reject(err)

			req.onsuccess = e => {
				const cursor = e.target.result
				if (cursor) {
					assets.push(cursor.value)
					cursor.continue()
				} else {
					resolve(assets)
				}
			}
		})
	}


	async find ({ index, val }) {
		return new Promise((resolve, reject) => {
			const keys = typeof val === 'string' ? [val] : val.sort()
			var assets = [],
				i = 0

			var req = _storesDatabase.transaction(this.store, 'readonly').objectStore(this.store).index(index).openCursor()

			req.onerror = err => reject(err)

			req.onsuccess = e => {
				var cursor = e.target.result

				if (!cursor) {
					resolve(assets)
					return
				}

				var key = cursor.key
				while (key > keys[i]) {
					++i
					if (i === keys.length) {
						resolve(assets)
						return
					}
				}

				if (key === keys[i]) {
					var cursorValue = cursor.value
					if (!cursorValue.isDeleted) {
						delete cursorValue.isDeleted
						assets.push(cursorValue)
					}
					cursor.continue()
				} else {
					cursor.continue(keys[i])
				}
			}
		})
	}


	async update (id, attributes) {
		var asset = await this._get(this.store, id)

        // TODO: Control if in attributes
		Object.keys(attributes).forEach(key => asset[key] = attributes[key])

		const queueAsset = await this._queuePut('U', asset)
		await this._queueSyncInternal(queueAsset.id)

		return true
	}


	async delete (id) {
		return this._delete(this.store, id)
	}
};let _gatewayConnected = false,
    _gatewayPromises = {},
    _gatewayWebsocket = null


const _gatewayInit = () => { 

    _gatewayWebsocket = new WebSocket(SEWOLI_CONFIG.GATEWAY.SERVER)

    _gatewayWebsocket.onopen = () => {
        _gatewayConnected = true
        console.log('CONNECTED')
        _authInit()
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
            /* switch(json.action) {
                case 'updateAuth':
                    swsServer.auth.updateAuth(json.user, json.jwt, true, true)
                    break;
                case 'syncToClient':
                    swsServer.db.__syncToClient(json.col, json.objects)
                    break;
                case 'updateTeams':
                    swsServer.auth.updateTeams(json.team, true)
                    break;
            } */
        }
    } 

    _gatewayWebsocket.onerror = err => {
        console.log('GATEWAY ERROR', err)
    }
}


const gatewaySend = json => {
    json.promiseId = Math.floor(Math.random() * 1000000000)

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
};let _webserverRoutesArr = [] // holds routes with metadata & controller function
const _webserverTemplates = {} // holds the templates of sewoli instance
let SEWOLI_CONFIG // the config will be filled in here
let _serverActive = false

const _activateWebserver = async () => {

    SEWOLI_CONFIG = await (await _webserverGetCache('/sewoli/config.json')).json()

    _webserverRoutesArr = []

    await Promise.all(SEWOLI_CONFIG.WEBSERVER.CONTROLLERS.map(async controllerTitle => {
        const controllerJavascript = await (await _webserverGetCache(`/sewoli/controllers/${controllerTitle}.js`)).text()
        eval(controllerJavascript)
        return
    }))

    if(typeof SEWOLI_CONFIG.GATEWAY.SERVER != 'undefined') {
        _databaseInit()
        _gatewayInit()
    }

    _serverActive = true
}

// executed for every fetch
const _fetchListener = async e => {

    // TODO: JUST IF DEV
    _activateWebserver()

    // get pathname from request data
    const { pathname } = new URL(e.request.url, self.location)

    _webserverRender({
        url: pathname,
        method: e.request.method,
        e
    })
}


const _webserverBuildResponse = (content, contentType = 'text/html') => 
    new Response(content, { 
        headers: {
            'Content-Type': contentType
        }
    })


const redirect = url => 
	new Response('', { 
		status: 302, 
		statusText: 'Found', 
		headers: { 
			Location: url 
		}
	})


// returns the cached version of an url or if not cached / DEV the original file
const _webserverGetCache = async (url, isOffline = false) => {
    
    if(SEWOLI_CONFIG && SEWOLI_CONFIG.ENVIROMENT === 'DEV') {
        const res = await fetch(url)
        return res
    }

    const cache = await caches.open('cache')
    const matching = await cache.match(url)

    if(matching) {
        return matching
    } else {
        const res = await fetch(url)
        cache.put(url, res)
        return _webserverGetCache(url)
    }
}


const addRoute = ({ route, fn }) => {
    let routeArr = route.split('/')

    routeArr.shift()
    routeArr.pop()

    const regexString = (
        '(?<!{)\\/' + 
        routeArr.map(val => (val.charAt(0) === ':') ? '([^}\\n]*)' : val)
        .join('\\/')
        + '\\/'
    ).replace('\\/\\/', '\\/')

    _webserverRoutesArr.push({
        route,
        fn,
        regex: new RegExp(regexString, 'g'),
        sort: regexString.length,
        routeArr
    })

    _webserverRoutesArr.sort((a, b) => b.sort - a.sort)
}


const _webserverParseParams = (routeParsed, url) => {
    const urlArr = url.split('/')
    urlArr.shift()
    urlArr.pop()

    let params = {}
    routeParsed.routeArr.forEach((val, i) => {
        if (val.charAt(0) === ':') {
            params[val.substring(1)] = urlArr[i]
        }
    })
    return params
}


const _webserverParseUrl = url => {
    return _webserverRoutesArr.find(val => url.search(val.regex) == 0)
}

const _getFormDataObj = formData => {
    let formDataObj = {}
        
    for(var pair of formData.entries()) {
        formDataObj[pair[0]] = pair[1]
    }

    return formDataObj 
}

// 
const _webserverRender = ({ url, method, e }) => {
    e.respondWith(new Promise(async (resolve, reject) => {

        if(url.split('/')[1] === 'static') {
            const file = await _webserverGetCache(url)
            resolve(file)
        }

        const formDataObj = method === 'POST'
            ? _getFormDataObj(await e.request.formData())
            : {}

        const routeParsed = _webserverParseUrl(url)

        if(routeParsed) {

            const params = _webserverParseParams(routeParsed, url)

            routeParsed.fn(params, formDataObj).then(res => {
                resolve(res)
            }).catch(err => {
                var res = 'ERROR (' + err + ')';
                resolve(_webserverBuildResponse(res))
            })

        } else {
            var res = 'ERROR (404)';
            resolve(_webserverBuildResponse(res))
        }

    }))
}


const renderTemplate = async ({ template, data, buildResponse = true }) => {
    if(_webserverTemplates[template] && SEWOLI_CONFIG.ENVIROMENT != 'DEV') {
        if(buildResponse) {
            return _webserverBuildResponse(await _webserverTemplates[template](data))
        } else {
            return await _webserverTemplates[template](data)
        }
    } else {
        const file = await _webserverGetCache('/sewoli/templates/'+ template +'.html')
        const code = await file.text()

        parseTemplate(template, code)

        if(buildResponse) {
            return _webserverBuildResponse(await _webserverTemplates[template](data))
        } else {
            return await _webserverTemplates[template](data)
        }
    }
}


const parseTemplate = (templateName, code) => {
    
    // get config script tag
    let regexp = /<script\b[^>]*>([\s\S]*?)<\/script>/gm
    let execRegex = new RegExp(regexp)
    let configScript = execRegex.exec(code)
    let configJson = configScript && configScript[1] ? JSON.parse(configScript[1]) : {}

    let template = configScript && configScript[0] ? code.split(configScript[0]).join('') : code

	template = template.replace(/{#if ([\s\S]*?)}([\s\S]*?){\/if}/gm, (a, b, c) => 
        c.includes('{:else}')
            ? '${(() => { if('+ b +') {  return `'+ c +'` }})() }'
            : '${(() => { if('+ b +') {  return `'+ c +'` } else {return `` }})() }'
    )

	template = template.replace(/{:else if ([\s\S]*?)}/gm, (a, b) =>
        '`} else if('+ b +') { return `'
	)

	template = template.split('{:else}').join('` } else { return `')

	template = template.replace(/{#each ([\s\S]*?) as ([\s\S]*?)}/gm, (a, b, c) =>
        '${(await Promise.all('+ b +'.map(async ('+ c +', index) => `'
    )

    template = template.split('{/each}').join('`))).join(\'\')}')

    template = template.replace(/{{([\s\S]*?)}}/gm, (a, b) =>
    '${'+ b +'}'
    )

    if(configJson && configJson.components) {
        for (const [moduleTitle, templateTitle] of Object.entries(configJson.components)) {
            var componentRegexp = new RegExp('<'+ moduleTitle +'([\\s\\S]*?)\/>', 'gm')
            template = template.replace(componentRegexp, (a, b) => {

                let componentData = {}
                b.split('" ').forEach(val => {
                    if(val.includes('=')) {
                        const splitted = val.split('=')
                        componentData[(splitted[0].trim())] = (splitted[1].replace(/(^"|"$)/g, ''))
                    }
                })

                return '${await renderTemplate({ template: \''+ templateTitle +'\', data: '+ JSON.stringify(componentData) +', buildResponse: false })}'
            })
        }
    }


    _webserverTemplates[templateName] = eval(`async ({ ${configJson && configJson.attributes ? configJson.attributes.join(',') : ''} }) => \`${template}\``)
}