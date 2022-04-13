const bs = require('browser-sync').create(),
	watch = require('node-watch'),
	sass = require('node-sass'),
	terser = require('terser'),
	mkpath = require('mkpath'),
	fs = require('fs'),
	path = require('path'),
    { minify } = require('terser')

/* Browser Sync Server */
bs.init({
	server: './public',
	open: false,
	port: 3005
})



/* Watch Task: Styles */
watch('./src/frontend/styles', { recursive: true }, async () => {
	const css = await renderSass(),
		isPathMade = await makePath('public/static'),
		isFileWritten = await writeFile('./public/static/s.css', css.css)
	console.log('Frontend Styles updated!')
})



/* Watch Task: Frontend Javascript */
watch('./src/frontend/javascript', { recursive: true }, async (evt, name) => {

	const jsFiles = getFilteredFiles('./src/frontend/javascript', /\.js$/),
		contentArr = await Promise.all(jsFiles.map(async file => await readFile(file))),
		code = contentArr.join(';'),
		codeMinified = await minify(code, { mangle: false}),
		isPathMade = await makePath('public/static')
		console.log(codeMinified)
	writeFile('./public/static/s.js', codeMinified.code)
	console.log('Frontend Javascript updated!')
})


/* Watch Task: Service Worker */
watch(['./scripts/core', './scripts/utils'], { recursive: true }, async (evt, name) => {

	const coreFiles = getFilteredFiles('./scripts/core', /\.js$/),
		utilFiles = getFilteredFiles('./scripts/utils', /\.js$/)

	const toConcat = coreFiles.concat(utilFiles)

	const contentArr = await Promise.all(toConcat.map(async file => await readFile(file)))
	const code = contentArr.join(';')

    // const uglifiedContent = await minify(code, { mangle: false})
	
	writeFile('./public/sw.js', code)
	console.log('Service Worker updated!')
})


const promisify = async (fn, args) => {
	return new Promise((resolve, reject) => fn(args, resolve, reject))
}

const renderSassRaw = ({ }, resolve, reject) =>
	sass.render({
		file: './src/frontend/styles/styles.scss',
		outFile: './public/static/s.css'
	}, (err, val) =>
		!err ? resolve(val) : reject('err: sass-render' + err)
	)

const renderSass = path => promisify(renderSassRaw, { })

const writeFileRaw = ({ pathToWrite, content }, resolve, reject) =>
		fs.writeFile(pathToWrite, content, 'utf8',
			err =>
			!err ? resolve(true) : reject('err: write-file' + err)
		)

const writeFile = (pathToWrite, content) => promisify(writeFileRaw, { pathToWrite, content })

const makePathRaw = ({ dirToMake }, resolve, reject) =>
		mkpath(dirToMake,
			err =>
			!err ? resolve(true) : reject('err: mkpath')
		)

const makePath = dirToMake => promisify(makePathRaw, { dirToMake })


const getFiles = dir => {
	return fs.statSync(dir).isDirectory()
				? Array.prototype.concat(...fs.readdirSync(dir).map(f => getFiles(path.join(dir, f))))
				: dir
}

const getFilteredFiles = (dir, filter) => getFiles(dir).filter(val => val.match(filter))

const readFileRaw = ({ pathToRead }, resolve, reject) =>
		fs.readFile(pathToRead, 'utf8',
			(err, val) =>
			!err ? resolve(val) : reject('err: read-file' + err)
		)

const readFile = pathToRead => promisify(readFileRaw, { pathToRead })








