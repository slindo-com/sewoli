const fn = async ({}, formData) => {
    return renderTemplate({
        template: 'index/templating-examples',
        data: {
            pageTitle: 'Templating Examples',
            text: 'This is a text to display',
            number: 1,
            items: [{
                title: 'First Item',
                number: 1
            }, {
                title: 'Second Item',
                number: 2
            }]
        }
    })
}

addRoute({
    route: '/templating-examples/',
    fn
})