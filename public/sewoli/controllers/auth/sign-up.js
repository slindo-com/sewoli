const fn = async ({}, { email, password }) => {

    if(email && password) {
        const user = await signUp({
            email,
            password
        }).catch(err => {
            console.log('ERR', err)
        })

        console.log('USER', user)
    }

    return renderTemplate({
        template: 'auth/sign-up',
        data: {
            pageTitle: 'Sign Up'
        }
    })
}

addRoute({
    route: '/sign-up/',
    fn
})