const fn = async ({}, formData) => {
    return renderTemplate({
        template: 'index/index',
        data: {
            pageTitle: 'Welcome to Sewoli!'
        }
    })
}

addRoute({
    route: '/',
    fn
})