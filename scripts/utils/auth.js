/* let _hasAuth = false


const _auth = async () => {
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
            console.log('TEST')
            await keyValueSet('jwt', '')
            resolve(res)
        }).catch(reject)
    })


const sendPasswordMail = ({ email }) => {

}


const hasAuth = () => _hasAuth*/