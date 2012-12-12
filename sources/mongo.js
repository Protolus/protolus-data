//todo: events support
var prime = require('prime');
var Class = require('Classy');
var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var Emitter = require('prime/util/emitter');
var fs = require('fs');
var mongo = require("mongojs");
var ObjectID = require('mongodb').ObjectID;
var Data = require('../protolus-data');

prime.clone = function(obj){
    var result;
    switch(type(obj)){
        case 'object':
            result = {};
            for(var key in obj){
                result[key] = prime.clone(obj[key]);
            }
            break;
        case 'array':
            result = obj.slice(0);
            break;
        default : result = obj;
    }
    return result;
};

var isNumeric = function(value){
    return (!isNaN(value * 1)) || value.match(/^[0-9][0-9a-f]*$/);
};

var MongoDatasource = new Class({
    Extends : Data.Source,
    collections : {},
    debug : true,
    initialize: function(options){
        //todo: support replica sets
        options.type = 'mongo';
        this.parent(options);
        this.connection = mongo.connect(options.host+"/"+options.database);
    },
    getRepresentation : function(typeName, value){
        var result = value;
        switch(typeName){
            case 'mongoid':{
                //console.log('woo', type(result));
                if(type(result) == 'object') result = result.toString(); //it's possible this is already an object
                result = this.connection.ObjectId(result);
            }
        }
        return result;
    },
    buildPredicate: function(predicate, options, object){
        var result = {};
        var stack = result;
        array.forEach(predicate, fn.bind(function(item){
            if(type(item) == 'array'){
                //result.push('('+this.buildPredicate(item)+')');
                
            }else{
                if(item.type == 'conjunction'){
                    if(item.value === '&&') item.value = 'and';
                    if(item.value === '||') item.value = 'or';
                    if(item.value !== 'and'){
                        // todo: push this condition onto the stack
                        // if next is array, else
                    }   // else: we're ANDing, so we only need additional elements within a flat array
                }
                if(item.type == 'expression'){
                    var value = (
                        (isNumeric(item.value) || item.value == 'true' || item.value == 'false')
                        ?parseFloat(item.value)
                        :item.value
                    );
                    if(item.operator === '='){
                        result[item.key] = object.getByType(item.key, item.value);
                    }else{
                        switch(item.operator){
                            case '>=':
                            case '<=':
                            case '>':
                            case '<':
                            case '<>':
                            case '!=':
                        }
                    }
                    
                }
            }
        }, this));
        return stack;
    },
    lastId : function(type, callback){
        
    },
    performSearch : function(type, predicate, options, callback, errorCallback){
        if(!this.collections[type]) this.collections[type] = this.connection.collection(type);
        var collection = this.collections[type];
        var request = (this.debug?'db.'+type+'.find('+JSON.stringify(predicate)+', '+JSON.stringify(options)+')':'db.'+type+'.find({...}, '+JSON.stringify(options)+')');
        var floor = ((options.limit && options.page)?options.limit * (options.page-1):(options.skip?options.skip:1));
        //console.log('['+'DATA CALL'+']'+request);
        if(predicate['_id']) predicate['_id'] = new ObjectID(predicate['_id']);
        var query = collection.find(predicate, fn.bind(function(err, objects) {
            if( err ){
                if(errorCallback) errorCallback(err);
            } else{
                query.count(fn.bind(function(err, count) {
                    var lastElement = (floor-1)+objects.length;
                    var range = ((lastElement == floor)?lastElement:(floor+1)+'-'+(lastElement+1));
                    //console.log('['+'DATA'+(this.debug?' RETURN':'')+'] '+request+(objects && objects.length?' -> {'+range+(lastElement+1>=count?'':'/'+count)+'}':''));
                    callback(objects, {count: count, page:(options.page?options.page:1)});
                }, this));
            }
        }, this));
        if(options.limit) query.limit(options.limit);
        if(options.limit && options.page) query.skip( options.limit * (options.page-1));
        else if(options.skip) query.skip(options.skip);
    },
    escape: function(value){
        return value;
    },
    save : function(object, callback, errorCallback){
        if(!this.collections[object.options.name]) this.collections[object.options.name] = this.connection.collection(object.options.name);
        if(object.exists){
            var payload = prime.clone(object.data);
            delete payload[object.primaryKey];
            var originalPayload = prime.clone(payload)
            var updateOn = {};
            updateOn[object.primaryKey] = object.get(object.primaryKey, true);
            if(object.permissions) payload['permissions'] = object.permissions;
            var request = (this.debug?'db.'+object.options.name+'.update('+JSON.stringify(updateOn)+', '+JSON.stringify(payload)+')':'db.'+object.options.name+'.update({...})');
            //console.log('['+'DATA CALL'+']'+request);
            this.collections[object.options.name].update(
                updateOn,
                payload,
                {},
                fn.bind(function(err, data) {
                    if( err ){
                        if(errorCallback) errorCallback(err);
                    } else {
                        //console.log('['+'DATA'+(this.debug?' RETURN':'')+'] '+request);
                        callback(object.data, {});
                    }
                }, this));
        }else{
            var inserted = prime.clone(object.data);
            var request = (this.debug?'db.'+object.options.name+'.insert('+JSON.stringify(inserted)+')':'db.'+object.options.name+'.insert({...})');
            //console.log('['+'DATA CALL'+']'+request);
            this.collections[object.options.name].insert(object.data, fn.bind(function(err, data){
                if( err ){
                    console.log(err);
                    if(errorCallback) errorCallback(err);
                }else{
                    //object.data = data;
                    //console.log('['+'DATA'+(this.debug?' RETURN':'')+'] '+request);
                    callback(data[0], {});
                }
            }, this));
        }
    },
    load : function(object, callback, errorCallback){
        var loadOn = {};
        loadOn[object.primaryKey] = object.get(object.primaryKey, true);
        this.performSearch(object.options.name, loadOn, {},fn.bind(function(data) {
            if(data.length > 0){
                object.data = data[0];
                callback(data[0], {});
            }else errorCallback();
        }, this), fn.bind(function(err){
            if(errorCallback) errorCallback(err);
        }, this));
    },
    delete : function(object, callback, errorCallback){
        if(!this.collections[object.options.name]) this.collections[object.options.name] = this.connection.collection(object.options.name);
        var deleteOn = {};
        deleteOn[object.primaryKey] = object.get(object.primaryKey);
        this.collections[object.options.name].remove( deleteOn,
            fn.bind(function(err) {
                if( err ){
                    if(errorCallback) errorCallback(err);
                } else {
                    if(Protolus.verbose){
                        if(!this.debug) console.log('['+AsciiArt.ansiCodes('DATA', 'magenta')+'] db.'+object.options.name+'.delete(...)');
                        else console.log('['+AsciiArt.ansiCodes('DATA', 'magenta')+'] db.'+object.options.name+'.delete('+JSON.encode(deleteOn)+')');
                    }
                    if(callback) callback(object.data, {});
                }
            }, this)
        );
    }
});
module.exports = MongoDatasource;