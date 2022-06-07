const fn = async ({}, { todo }) => {

    if(todo) {
        await getStore('project').new({
            title: todo
        })
    }

    const projects = await getStore('project').getAll()

    if(!hasAuth()) {
        return redirect('/sign-in/')
    }

    return renderTemplate({
        template: 'todo/todo',
        data: {
            pageTitle: 'Todo List',
            hasAuth: hasAuth(),
            projects
        }
    })
}

addRoute({
    route: '/todo/',
    fn
})