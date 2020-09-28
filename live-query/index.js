const Parse = require('parse/node');

Parse.serverURL = 'https://myb4asubdomain.b4a.io';
Parse.initialize('myappid', 'myjskey');

const main = async () => {
  const query = new Parse.Query('Todo');
  query.notEqualTo('isClosed', true);

  const subscription = await query.subscribe();

  let todos = {};

  const printTodos = () => {
    console.log();
    console.log('This is the live updated list of not closed todos')
    Object.keys(todos).forEach(id => {
      console.log(todos[id].toJSON());
    });
    console.log();
  };

  subscription.on('open', async () => {
    console.log('subscription opened');
    todos = {};
    todos = (await query.find()).reduce((todos, todo) => ({
      ...todos,
      [todo.id]: todo
    }), todos);
    printTodos();
  });

  subscription.on('create', todo => {
    console.log(`todo ${todo.id} created`);
    todos[todo.id] = todo;
    printTodos();
  });

  subscription.on('update', todo => {
    console.log(`todo ${todo.id} updated`);
    todos[todo.id] = todo;
    printTodos();
  });

  subscription.on('enter', todo => {
    console.log(`todo ${todo.id} entered`);
    todos[todo.id] = todo;
    printTodos();
  });

  subscription.on('leave', todo => {
    console.log(`todo ${todo.id} left`);
    delete todos[todo.id];
    printTodos();
  });

  subscription.on('delete', todo => {
    console.log(`todo ${todo.id} deleted`);
    delete todos[todo.id];
    printTodos();    
  });

  subscription.on('close', () => {
    console.log('subscription closed');
    printTodos();
  });
};

main();
