var jsonrpc = require('multitransport-jsonrpc');
var Server = jsonrpc.server;
var ChildProcTransport = jsonrpc.transports.server.childProcess;
var q = require('queue-flow');

// The queue-flow object that will do the user-specified processing
var theQ = q();
// The queue-flow object that results will be streamed into
var lastQ;
// The callbacks fed into the child process. Relying on the queueing
// nature of queue-flow to keep the order intact.
var callbackArr = [];

// The queue-flow child is implemented as a multitransport-jsonrpc child process server,
// which makes the communication over the IPC transport simple and Node-like.
var server = new Server(new ChildProcTransport(), {
    // To initialize the child process's environment, the source code to a function is
    // passed in, evaled, and then run which assumes that eventually a callback is called
    // that is given the scope object to attach to the global scope of the child process.
    init: function init(methodSrc, callback) {
        var initFunc = eval(methodSrc);
        if(!(initFunc instanceof Function)) {
            callback(new Error('Did not receive an initialization method'));
            process.exit(-1);
        } else {
            initFunc(function(scope) {
                for(var key in scope) {
                    global[key] = scope[key];
                }
                callback(null, 'Initialized successfully!');
            });
        }
    },
    // This method takes a chunk of data and adds it into
    // the processing queue, and takes the callback and adds
    // it to the callback queue; when the data is processed,
    // the callback will be popped back out and used to return
    // the result to the parent process.
    process: function process(data, callback) {
        theQ.push(data);
        callbackArr.push(callback);
    },
    // This method closes the queue, and when all of the data
    // has been processed, calls the callback and then shuts
    // down the process
    close: function close(callback) {
        theQ.close();
        lastQ.on('close', function() {
            callback(null, 'Closed Successfully');
            server.shutdown(function() {
                process.exit();
            });
        });
    },
    // This method establishes how exactly data should be
    // processed in this child process, and then takes the
    // results and passes it into the appropriate callback.
    // TODO: How to handle .node/.promise/.exec that send
    // errors to a separate queue?
    // TODO: Also need to handle reduce and filter appropriately
    // this solution only handles map-like operations well.
    useMethod: function useMethod(method, args, callback) {
        if(theQ[method] instanceof Function) {
            lastQ = theQ[method].apply(theQ, args)
                .forEach(function(result) {
                    var currCallback = callbackArr.unshift();
                    currCallback(null, result);
                });
            callback(null, 'Method registered');
        } else {
            callback(new Error('Method Not Found'));
        }
    }
});