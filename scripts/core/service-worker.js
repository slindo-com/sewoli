self.addEventListener('install', () =>
    console.log('SEWOLI INSTALLED')
)

self.addEventListener('activate', async () =>
    _activateWebserver()
)

self.addEventListener('fetch', async e => 
    _fetchListener(e)
)