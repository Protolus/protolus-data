//todo: events support
var Class = require('Classy');
var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var Emitter = require('prime/util/emitter');
var fs = require('fs');
var amqp = require("amqp");
var Data = require('../protolus-data');

var RabbitDatastream = new Class({
    Extends: Data.Stream,
    connected : {},
    init : {},
    readyQueue : {},
    queues : {},
    bindings : {},
    initialize : function(options){
        this.parent(options);
        this.connection = amqp.createConnection(
            { host: this.options.host }, 
            { defaultExchangeName: this.options.exchange}
        );
    },
    queue : function(type, callback){ //make sure binding exists
        this.connection.on('ready', function(){
            if(!this.connected[type]){
                if(!this.readyQueue[type]) this.readyQueue[type] = [];
                this.readyQueue[type].push(callback);
                if(this.init[type]){
                    if(!this.init[type]) this.init[type] = true;
                    var q = this.connection.queue( //make sure our queue exists
                        this.options.queue, 
                        { //queue options
                            "durable": true, 
                            'autoDelete': false, 
                            'passive': false
                        }, 
                        fn.bind(function(){
                            q.bind(this.connection.exchange, type, fn.bind(function(){
                                this.queues[type] = q;
                                this.connected[type] = true;
                                while(this.readyQueue[type].length > 0){
                                    var cb = this.readyQueue[type].shift();
                                    cb(q);
                                }
                                callback(q);
                            }, this));
                        }, this)
                    );
                }
            }else{
                callback(this.queues[type]);
            }

        });
    },
    fireEvent : function(options, payload, callback){
        if(typeOf(options) =='string') options = {type:options};
        this.queue(options.type, function(queue){
            queue.publish(options.type, payload);
            if(callback) callback();
        }.bind(this));
    },
    addEvent: function(options, callback){
        this.queue(options.type, fn.bind(function(queue){
            queue.subscribe(fn.bind(function(message, headers, deliveryInfo){
                try{
                    //this is the super sketch part where we convert the payload from an array to a string... WTF?!?!
                    var n = '';
                    for(var lcv =0; lcv < message.data.length; lcv++){
                        n += String.fromCharCode(message.data[lcv+'']);
                    }
                    var dt = {
                        message : JSON.decode(n),
                        headers : headers,
                        info : deliveryInfo
                    };
                    callback(dt);
                }catch(ex){
                    if(this.options.onError) this.options.onError(ex);
                }
            }, this));
        }, this));
    },
    removeEvent:function(){
        //todo: do
    }
});
module.exports = RabbitDatastream;