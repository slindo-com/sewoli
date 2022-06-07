const fn = async ({}, { email, password }) => {

    if(email && password) {
        const user = await signIn({
            email,
            password
        }).catch(err => {
            console.log('ERR', err)
        })

        console.log('USER', user)
    }

    return renderTemplate({
        template: 'auth/sign-in',
        data: {
            pageTitle: 'Sign In'
        }
    })
}

addRoute({
    route: '/sign-in/',
    fn
})