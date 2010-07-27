## Some examples.

Note: a large number of usage examples can be found in `../test/test.js`.

## Publisher-Subscriber (PUBSUB)

In one terminal:

    $ ./publisher.js
    Published message to no one.
    Published message to no one.
    Published message to no one.
    Published message to 1 subscriber(s).        <-- Started the subscriber.
    Published message to 1 subscriber(s).
    Published message to 1 subscriber(s).
    Published message to 1 subscriber(s).
    Published message to no one.                 <-- Killed (^C) the subscriber.
    ^C

In another terminal:

    $ ./subscriber.js 
    waiting for messages...
    [channel-6702921148389578]: The time is Fri Apr 02 2010 16:52:19 GMT-0400 (EDT)
    [channel-9212789069861174]: The time is Fri Apr 02 2010 16:52:20 GMT-0400 (EDT)
    [channel-30327219143509865]: The time is Fri Apr 02 2010 16:52:21 GMT-0400 (EDT)
    [channel-35810230672359467]: The time is Fri Apr 02 2010 16:52:22 GMT-0400 (EDT)
    [channel-5208229701966047]: The time is Fri Apr 02 2010 16:52:23 GMT-0400 (EDT)
    [channel-26559297926723957]: The time is Fri Apr 02 2010 16:52:24 GMT-0400 (EDT)
    [channel-9280104916542768]: The time is Fri Apr 02 2010 16:52:25 GMT-0400 (EDT)
    ^C

