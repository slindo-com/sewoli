let _storesConnection

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
}