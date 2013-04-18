var q = require('queue-flow');

process.on('message', function(obj) {
    switch(obj.type) {
    case 'push':
        //TODO: Fill this in
        break;
    case 'close':
        //TODO
        break;
    case 'useMethod':
        //TODO
        break;
    }
});

//TODO: Get process.argv to get init function and run it, once finished, *then* process any messages received

// Take the init function string passed in as the last argument and eval it into a function
// If it's not actually a function, exit immediately
var initFunc = eval(process.argv[process.argv.length-1]);
if(!(initFunc instanceof Function)) process.exit(-1);

// Run the init function and attach the relevant properties to the global scope
initFunc(function(scope) {
    for(var key in scope) {
        global[key] = scope[key];
    }
});