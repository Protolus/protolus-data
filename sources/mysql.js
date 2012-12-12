//todo: events support
var prime = require('prime');
var Class = require('Classy');
var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var Emitter = require('prime/util/emitter');
var fs = require('fs');
var mysql = require("mysql");
var dateformat = require('dateformat');
var Data = require('../protolus-data');

prime.merge = function(objOne, objTwo){
    var result = {};
    prime.each(objOne, function(item, key){
        result[key] = item;
    });
    prime.each(objTwo, function(item, key){
        if(!result[key]) result[key] = item;
    });
    return result;
};
array.contains = function(haystack, needle){ //parallel
    return haystack.indexOf(needle) != -1;
};
prime.values = function(object){
    var result = [];
    for(var key in object) result.push(object[key]);
    return result;
};
prime.filter = function(obj, filter){
    var result = {};
    prime.each(obj, function(item, key){
        if(filter(item, key)) result[key] = item;
    });
    return result;
};

var isNumeric = function(value){
    return (!isNaN(value * 1)) || value.match(/^[0-9][0-9a-f]*$/);
};

var MySQLDatasource = new Class({
    Extends : Data.Source,
    debug : false,
    initialize: function(options){
        options.type = 'mysql';
        this.parent(options);
        this.connection = mysql.createClient(options);
    },
    log : function(text){
        //console.log('[DATA]', text);
    },
    getRepresentation : function(type, value){
        switch(this.options[key]['type']){
            case 'mongoid': throw('mongoIDs cannot be used in a MySQL context');
            default : return this.data[key];
        }
    },
    lastId : function(type, callback, errorCallback){
        this.execute(
            'SELECT LAST_INSERT_ID() as id from '+type+' LIMIT 1;', //WTF do I have to set LIMIT 1 here (node-driver hell)?!?!?!?!
            function(results){
                if(callback) callback(results[0]['id']);
            },
            errorCallback
        );
    },
    buildPredicate: function(predicate, options, object){ // the real where clause builder
        var result = [];
        array.forEach(predicate, fn.bind(function(item){
            if(type(item) == 'array'){
                result.push('('+this.buildPredicate(item)+')');
            }else{
                if(item.type == 'conjunction'){
                    if(item.value === '&&') item.value = 'and';
                    if(item.value === '||') item.value = 'or';
                    result.push(item.value.toUpperCase());
                }
                if(item.type == 'expression'){
                    var value = (
                        (isNumeric(item.value) || item.value == 'true' || item.value == 'false')
                        ?item.value
                        :'\''+item.value+'\''
                    );
                    result.push('`'+item.key+'` '+item.operator+' '+value);
                }
            }
        }, this));
        return result.join(' ');
    },
    performSearch : function(dataType, predicate, options, callback, errorCallback){
        var query = '';
        if(type(predicate) == 'string'){ //raw sql
            query = 'SELECT * FROM '+dataType+(predicate!=''?' WHERE '+predicate:'');
        }else{ // json based search object
            //something else?
        }
        this.execute(query, callback, errorCallback);
    },
    escape: function(value){
        return this.connection.escape(value);
    },
    execute: function(query, callback, errorCallback){
        this.connection.query(query, fn.bind(function(error, results, fields){
            if(this.debug) console.log('['+AsciiArt.ansiCodes('Query', 'blue')+']:'+query);
            if(this.debug) console.log('['+AsciiArt.ansiCodes('Results', 'blue')+']:'+JSON.encode(results));
            this.log(query+(results && results.length?' -> {'+results.length+'}':''), 'Query');
                /*else this.log(query.split( / ([wW][Hh][Ee][Rr][Ee]|[Ss][Ee][Tt]) / ).shift()+'...'+(results && results.length?' -> {'+results.length+'}':''), 'Query');
            }*/
            if(error && errorCallback) {
                errorCallback('[MySQL]'+error);
                return;
            }
            if(results == 'undefined' && errorCallback){
                errorCallback('[MySQL]'+error);
                return;
            }
            //todo: handle auto initialize
            if(this.verbose && results) this.log(JSON.encode(results), 'Results');
            if(callback) callback(results);
        }, this));
    },
    load : function(object, callback, errorCallback){
        if(!object.get(object.primaryKey)){
            if(errorCallback) errorCallback('No id to load!');
            else throw('No id to load!');
            return false;
        }
        this.execute(
            'select * from '+object.options.name+' where '+object.primaryKey+' =\''+object.get(object.primaryKey)+'\'',
            fn.bind(function(results){
                if(!results || results.length == 0){ if(errorCallback) errorCallback('Object['+object.get(object.primaryKey)+'] not found', errorCallback);
                }else{
                    object.data = results[0];
                    object.exists = true;
                    if(callback) callback(object.data);
                }
            }, this),
            errorCallback
        );
    },
    save : function(object, callback, errorCallback){
        var now = dateformat(new Date(), "yyyy-mm-dd'T'HH:MM:ss");
        var data = prime.merge(object.data, {
            modification_time : now
        });
        data = prime.filter(data, fn.bind(function(item, key){
            return array.contains(Data.coreFields, key) || array.contains(object.fields, key);
        }, this));
        if(object.exists){
            var updates =  [];
            delete data[object.primaryKey];
            prime.each(data, fn.bind(function(value, key){
                updates.push(key+' = '+(type(value) == 'number'?value:this.connection.escape(value)));
            }, this));
            this.execute(
                'update '+object.options.name+' set '+updates.join(',')+' where '+object.primaryKey+' =\''+object.get(object.primaryKey)+'\'', 
                fn.bind(function(results){
                    if(callback) callback(object.data);
                }, this),
                errorCallback
            );
        }else{ // new object
            data.creation_time = now;
            this.execute(
                'insert into '+object.options.name+' ('+Object.keys(data).join(', ')+') values ('+
                    prime.values(data).map(function(value){
                        return this.connection.escape(value);
                    }.bind(this)).join(',')+')', 
                fn.bind(function(results){
                    object.exists = true;
                    this.lastId(
                        object.options.name, 
                        function(id){
                            object.set(object.primaryKey, id);
                            object.load(
                                id, 
                                function(data){ //make sure to pick up any new data
                                    if(callback) callback(this.data);
                                }.bind(object),
                                function(error){
                                    console.log('selecterror', error);
                                }
                            );
                        }.bind(this),
                        function(error){
                            console.log('selecterror', error);
                        }
                    );
                }, this),
                function(error){
                    if(errorCallback) errorCallback(error);
                    else throw(error);
                }
            );
        }
    }
});
module.exports = MySQLDatasource;