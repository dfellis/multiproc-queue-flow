# multiproc-queue-flow

[![Build Status](https://secure.travis-ci.org/dfellis/multiproc-queue-flow.png?branch=master)](https://travis-ci.org/dfellis/multiproc-queue-flow)

## True queue pipelining

multiproc-queue-flow is a [queue-flow](http://dfellis.github.com/queue-flow) constructor function that alters queue-flow so steps in your queue are like stages in a processing pipeline. Each step is run in a separate process, with the main process simply streaming results from one process for one step into another process for the next step. This means whether your code is asynchronous or not, whether it is calling out to databases, remote servers, or calculating values in-process, each "stage" in the pipeline is "spinning" independently and truly simultaneously.

This pipelining allows previously untenable queues of data to be processed. Suppose it takes 333ms to process some incoming data, its all CPU, and it depends on previous values that have come in (so you have to process them in-order), this means you can only process 3 chunks of data per second, so if you're getting 20 chunks of data per second in, your queue will backlog almost immediately, and your only saving grace would be if this is "bursty" behavior and it's not normally that high.

But if you could break your algorithm into 10 pieces, and suppose the CPU is evenly distributed between them, then you could run each stage on a separate CPU core, passing the results from one stage to the next, and while the total time to process the data is still 333ms, each stage only takes 33ms and then ask for the next chunk of data to process, bumping up your maximum throughput to 30 chunks of data per second with no other changes to your code.

Now suppose that half of the data you process is thrown out in your algorithm, if you put a filter in your pipeline to simply drop the, all of the stages after that can take 66ms to acheive the same 30 chunks per second rate (on the inflow, not the outflow of the pipeline).

If you're already familiar with queue-flow, you can see how code that's written with many small functions would benefit immensely from this. The greatest part is that unlike ``sloppy-queue-flow`` or ``parallel-queue-flow``, the semantics of ``queue-flow`` are not changed. All data is processed perfectly in order, using safe parellelization only between steps, rather than the trickier parallelization within the steps themselves.

## Why processes, why not [node-webworker-threads](https://github.com/audreyt/node-webworker-threads)

There good reasons to prefer threads to separate processes for this kind of work:

1. Cluster spins up a separate process for each processor your want to use, so there is extra memory involved in running an extra V8 VM on each one, plus a significant start-up time.
2. Message passing through cluster requires a serialize-transmit-deserialize stage that works against "really small" functions. They need to be doing enough work to justify the extra CPU and IO passing data around.
3. Its more difficult to leave your server in a weird state (running zombie processes) if something crashes, while with threads you're more likely to take the whole thing down (so at least you can restart quickly).

But there are limitations on what ``node-webworker-threads`` can do that mean a possible ``threaded-queue-flow`` would be a far more specialized library than ``multiproc-queue-flow``:

1. The worker threads must be pure javascript. No C++ methods. Therefore no ``http``, no ``net``, no ``dgram``, no ``fs``, nothing that does IO, basically.
2. The worker threads also do not understand ``require``, so you have to include the source of all pure-js libraries that you intend to use, as well.
3. The worker threads don't get the normal advantage with threads not requiring data copying. In fact, they don't even get the advantage over processes not needing the serialize-transmit-deserialize stage, [as it uses BSON serialization/deserialization internally](https://github.com/audreyt/node-webworker-threads/blob/master/src/WebWorkerThreads.cc#L760). The "transmit" stage is effectively zero, but for any non-trivial object where all threads/processes are on the same machine, the serialize and deserialize steps dominate.

So, ``multiproc-queue-flow`` gives you semantically identical behavior to ``queue-flow`` with, in reality, only queue start-up costs to pay versus threads in Node.js (none of those issues above would affect another language -- threads really are the better way to do it if you can).

## Usage

For details on how to use queue-flow generally, see the [main queue-flow website](http://dfellis.github.com/queue-flow).

``multiproc-queue-flow`` is a replacement constructor function for queue-flow, and to use in Node.js code, simply:

```js
var q = require('queue-flow');
var multiproc = require('multiproc-queue-flow');

q('pipelinedQueue', multiproc(initFunc))
    ... //Your code here
```

``multiproc`` is a function that returns a constructor that runs your queue in a pipeline. You may also pass in an initialization function (``initFunc``) that is run on each child process's startup to establish the environment. It uses the following signature:

```js
function initFunc(done) {
    done({
        http: require('http'),
        fs: require('fs')
    }); // The keys of this object are attached to ``global`` so your methods can use them.
    // Remember this function and *all* of the functions passed into the queue-flow methods
    // altered by multiproc-queue-flow are run on other processes, not your main process.
    // Only the keys in the object passed to ``done`` will be accessible to your methods.
}
```

## License (MIT)

Copyright (C) 2013 by David Ellis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
