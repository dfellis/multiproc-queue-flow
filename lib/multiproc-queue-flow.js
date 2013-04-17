// multiproc-queue-flow Copyright (C) 2013 by David Ellis
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var EventEmitter = require('async-cancelable-events');
var q = require('queue-flow');
var util = require('util');
var child_process = require('child_process');

// The `multiproc-queue-flow` constructor constructor function function
function multiproc(initFunc) {
    if(!initFunc) initFunc = function initBlank(done) { done({}); };
    function MultiQ(nameOrArray, q) {
        EventEmitter.call(this);
        this.qType = MultiQ;
        this.namespace = q;

        // TODO: General design plan is the constructor function spawns a child
        // process and passes the `initFunc.toString()` to it as a message.
        // Similarly, the various `queue-flow` methods are overridden by alternate
        // methods that simply pass the method name and arguments down to the
        // child process. The child process actually runs a bog-standard
        // `queue-flow` instance where the first item in the queue is the method
        // chosen and the relevant arguments, following that is a `reduce` that
        // messages the parent process with the relevant results. The parent 
        // process will provide `push` messages for incoming data throughout the
        // life of the process, and a `close` message at the end for the child
        // process to safely clean up, and it must send a `closed` message before
        // killing itself. For `kill`, no message is needed, the child process is
        // simply killed by the parent process. All events are handled by this
        // constructor function.
        this.child = child_process.fork('./queue-flow-child.js', [initFunc.toString()]);
        this.child.on('message', function childMessageHandler(message) {
            switch(message.type) {
            case 'pull':
                this.outQueue.push(message.value);
                break;
            case 'closed':
                this.kill();
                break;
            default:
                throw new Error('Impossible!');
            }
        });
        this.outQueue = undefined;

        this.push = function push() {
            var values = Array.prototype.slice.call(arguments, 0);
            this.emit('push', values, function(result) {
                if(result) {
                    this.child.send({
                        type: 'push',
                        values: values
                    });
                }
            }.bind(this));
        };
        this.close = function close() {
            this.emit('close', function(result) {
                if(result) {
                    this.child.send({
                        type: 'close'
                    });
                }
            }.bind(this));
        };
        this.kill = function kill() {
            this.emit('kill');
            // TODO: Cleanup goes here, not complete yet, so don't know what exactly to clean up
        };
    }

    util.inherits(MultiQ, EventEmitter);
    Object.keys(q.Q.prototype).forEach(function(method) {
        switch(method) {
        case 'as':
        case 'concat':
            MultiQ.prototype[method] = q.Q.prototype[method];
            break;
        case 'drain':
        case 'subqueue':
            // TODO: Should these go into child processes or no?
            /* falls through */
        default:
            MultiQ.prototype[method] = function() {
                this.outQueue = new this.qType(undefined, this.namespace);
                this.child.send({
                    type: 'useMethod',
                    method: method,
                    args: arguments
                });
                return this.outQueue;
            };
        }
    });

    return MultiQ;
}

return multiproc;
