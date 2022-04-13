const _webserverRoutesArr = [] // holds routes with metadata & controller function
const _webserverTemplates = {} // holds the templates of sewoli instance
let SEWOLI_CONFIG // the config will be filled in here
let _serverActive = false

const _activateWebserver = async () => {

    SEWOLI_CONFIG = await (await _webserverGetCache('/sewoli/config.json')).json()

    await Promise.all(SEWOLI_CONFIG.WEBSERVER.CONTROLLERS.map(async controllerTitle => {
        const controllerJavascript = await (await _webserverGetCache(`/sewoli/controllers/${controllerTitle}.js`)).text()
        eval(controllerJavascript)
        return
    }))

    _serverActive = true
}

// executed for every fetch
const _fetchListener = async e => {

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