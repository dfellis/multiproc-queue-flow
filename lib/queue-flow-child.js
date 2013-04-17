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