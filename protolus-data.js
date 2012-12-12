//todo: events support
var prime = require('prime');
var Class = require('Classy');
var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var regexp = require('prime/es5/regexp');
var Emitter = require('prime/util/emitter');
var fs = require('fs');
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

prime.keys = function(object){
    var result = [];
    for(var key in object) result.push(key);
    return result;
};

array.erase = function(arr, field){
    var index;
    while((arr.indexOf(field)) != -1){ //get 'em all
        arr.splice(index, 1); //delete the one we found
    }
};

var Options = new Class({
    setOptions : function(options){
        if(!this.options) this.options = {};
        var value;
        for(var key in options){
            value = options[key];
            if(this.on && key.substring(0,2) == 'on' && key.substring(2,3) == key.substring(2,3).toUpperCase()){
                var event = key.substring(2,3).toLowerCase()+key.substring(3);
                this.on(event, value);
            }
            this.options[key] = value;
        }
    }
});

var ProtolusData = new Class({
    data : {},
    primaryKey : 'id',
    datasource : null,
    exists : false,
    fields : [],
    virtuals : {},
    fieldOptions : {},
    initialize : function(options){
        if(!options.datasource) new Error('Datasource not specified for object!');
        if(!options.name) new Error('Data name not specified for object!');
        if(!ProtolusData.sources[options.datasource]) new Error('Datasource not found for object!');
        this.options = options;
        this.datasource = ProtolusData.Source.get(options.datasource);
        //console.log('C', (this.datasource == undefined), options, prime.keys(ProtolusData.sources));
        if(this.datasource){
            switch(this.datasource.options.type){ //convert from switch to DS callout
                case 'mongo':
                    //console.log('D');
                    if(this.primaryKey == 'id'){ //if we index by id, we'll assume mongo's _id will do just as well 
                        array.erase(this.fields, 'id');
                        this.virtualAlias('id', '_id');
                        /*
                        this.virtualSetter('id', function(value){
                            console.log('id', value);
                            throw ('Mongo IDs cannot be altered!');
                        }); //*/
                        this.primaryKey = '_id';
                        this.setOption('type', '_id', 'mongoid');
                    }
                    break;
                case 'mysql':
                
                    break;
            }
        }
    },
    get : function(key, typed){
        if(this.virtuals[key] && this.virtuals[key].get){
            return this.virtuals[key].get(key, typed);
        }else{
            if(this.data[key]){
                if(typed && this.fieldOptions[key] && this.fieldOptions[key]['type']){
                    return this.datasource.getRepresentation(this.fieldOptions[key]['type'], this.data[key]);
                }else{
                    return this.data[key];
                }
            }else{
                
            }
        }
    },
    getByType : function(key, value){
        if(this.virtuals[key] && this.virtuals[key].get){
            return this.virtuals[key].type(value);
        }else if(this.data[key]){
            if(this.fieldOptions[key] && this.fieldOptions[key]['type']) return this.datasource.getRepresentation(this.fieldOptions[key]['type'], value);
            else return value;
        }else return value;
    },
    set : function(key, value){
        if(this.virtuals[key] && this.virtuals[key].set){
            this.data[key] = this.virtuals[key].set(value);
        }else{
            this.data[key] = value;
        }
    },
    setOption : function(option, key, value){
        if(!this.fieldOptions[key]) this.fieldOptions[key] = {};
        this.fieldOptions[key][option] = value;
    },
    virtualSetter : function(key, callback){
        if(!this.virtuals[key]) this.virtuals[key] = {};
        this.virtuals[key]['set'] = callback;
    },
    virtualGetter : function(key, callback){
        if(!this.virtuals[key]) this.virtuals[key] = {};
        this.virtuals[key]['get'] = callback;
    },
    virtualByType : function(key, callback){
        if(!this.virtuals[key]) this.virtuals[key] = {};
        this.virtuals[key]['type'] = callback;
    },
    virtualAlias : function(key, value){
        if(!this.virtuals[key]) this.virtuals[key] = {};
        this.virtuals[key]['alias'] = value;
        this.virtualGetter(key, fn.bind(function(typed){
            if(typed && this.fieldOptions[key] && this.fieldOptions[key]['type']) return this.datasource.getRepresentation(this.fieldOptions[key]['type'], value);
            return this.get(value);
        }, this));
        this.virtualSetter(key, fn.bind(function(incoming){
            return this.data[value] = incoming;
        }, this));
        this.virtualByType(key, fn.bind(function(incoming){
            return this.getByType(value, incoming);
        }, this));
    },
    load : function(id, callback, errorCallback){
        this.set(this.primaryKey, id);
        return this.datasource.load(this, fn.bind(function(data){
            this.exists = true;
            //this.data = data;
            if(callback) callback(data);
        }, this), errorCallback);
    },
    delete : function(callback, errorCallback){
        return this.datasource.delete(this, callback, errorCallback);
    },
    save : function(callback, errorCallback){
        //if(!this.db) console.log('could not find datasource:'+this.options.datasource, Data.sources);
        if(this.permissions === true){//create new perms
            if(this.exists){
                if(this.progenitor){
                    this.permissions = this.progenitor.can('write', this);
                }else{
                    console.log(new Error().stack);
                    throw('object edited by unknown progenitor');
                }
            }else{
                if(this.progenitor){
                    this.permissions = this.progenitor.newPermissions();
                }else{
                    console.log(new Error().stack);
                    throw('object created by unknown progenitor');
                }
            }
        }
        return this.datasource.save(this, fn.bind(function(data, info){
            this.data = data;
            if(callback) callback(data, info);
        }, this), errorCallback);
    },
});
ProtolusData.dummies = {};
ProtolusData.classes = {};
ProtolusData.dummy = function(type, classDefinition){
    //if(!context) context = this;
    if(!ProtolusData.dummies[type]) ProtolusData.dummies[type] = new classDefinition();
    /*if(!ProtolusData.dummies[type]){
        try{
            context.eval('ProtolusData.dummies[type] = new cd();');
        }catch(ex){
            throw('Object type(\''+type+'\') not found');
        }
    }*/
    return ProtolusData.dummies[type];
};
ProtolusData.register = function(type, classDefinition){
    ProtolusData.classes[type] = classDefinition;
};
ProtolusData.require = function(type, makeGlobal){
    var classDefinition = require(type);
    ProtolusData.dummies[type] = new classDefinition();
    ProtolusData.register(type, classDefinition);
    if(makeGlobal) GLOBAL[type] = classDefinition;
    return classDefinition;
};
ProtolusData.parse = function(query, options){
    if(!ProtolusData.parser) ProtolusData.parser = new ProtolusData.WhereParser();
    return ProtolusData.parser.parse(query); //options?
};
ProtolusData.coreFields = ['modification_time', 'creation_time', 'modifier_id', 'creator_id', 'record_status'];
ProtolusData.sources = {};
ProtolusData.autoLink = false; // join logic 
var queryTyper = function(query, dummy, datasource){
    array.forEach(query, function(item, index){
        if(item.type == 'expression' && dummy.virtuals[item.key]){
            var alias = dummy.virtuals[item.key].alias
            query[index].key = alias;
            var a = query[index].value;
            if(query[index].key == '_id'){
                var ObjectID = require('mongodb').ObjectID;
                query[index].value = ObjectID(query[index].value);
            }
        }
    });
};
ProtolusData.search = function(objType, querystring, options, errorCallback){ //query is a query object or an object
    if(type(options) == 'function') options = {onSuccess: options};
    if(!options) options = {};
    if(errorCallback && type(errorCallback) == 'function') options['onFailure'] = errorCallback;
    var dummy = ProtolusData.dummy(objType);
    var datasource = Datasource.get(dummy.options.datasource);
    var query = ProtolusData.parse(querystring);
    queryTyper(query, dummy, datasource);
    return datasource.search(objType, query, options);
};
ProtolusData.query = function(objType, querystring, options, errorCallback){ //query is a query object or an object
    if(type(options) == 'function') options = {onSuccess: options};
    if(!options) options = {};
    if(errorCallback && type(errorCallback) == 'function') options['onFailure'] = errorCallback;
    var dummy = ProtolusData.dummy(objType);
    var datasource = ProtolusData.Source.get(dummy.options.datasource);
    var query = ProtolusData.parse(querystring);
    queryTyper(query, dummy, datasource);
    return datasource.query(objType, query, options);
};

ProtolusData.id = function(type){
    if(!type) type = 'uuid';
    switch(type){
        case 'uuid' :
            return System.uuid.v1();
            break;
        default:
        
    }
};
ProtolusData.BitMask = new Class({
    value : null,
    initialize : function(value, base){
        if(!base) base = 10;
        if(value) this.value = parseInt(value, base);
    },
    setBit : function(position, value){
        if(this.getBit(position)){ //it's set
            if(!value){//clear
                this.value = (1 << position) ^ this.value;
            }// else it's already set!
        }else{ //not set
            if(value){
                this.value = (1 << position) | this.value;
            }// it's already not set!
        }
    },
    getBit : function(position){
        return !!((1 << position) & this.value);
    },
    bits : function(){
        return this.value.toString(2);
    }
});
ProtolusData.Owner = new Class({ //an owner is an instance of Data
    groups : [],
    id : false,
    can : function(action, object){
        if(object.permissions){ //todo: these should cascade
            var mask = new Data.OwnershipMask(object.permissions.mask);
            if(this.id == object.permissions.owner){ //user
                return mask.hasPermission('user', action);
            }else if(this.groups.contains(object.permissions.group)){
                return mask.hasPermission('group', action);
            }else{
                return mask.hasPermission('world', action);
            }
        } else return true; //no perms
    },
    newPermissions : function(){
        var owner = this.get(this.primaryKey);
        return {
            'owner':owner,
            'group':this.groups[0],
            'mask':744
        }
    }
});
ProtolusData.OwnershipMask = new Class({
    Extends : ProtolusData.BitMask,
    contexts : ['user', 'group', 'world'],
    permissions : ['read', 'write', 'execute'],
    initialize : function(value){
        this.parent(value, 8);
    },
    getPosition: function(context, permission){
        var groupIndex = this.contexts.indexOf(context.toLowerCase());
        if(groupIndex === -1) throw('Unrecognized context('+context+')!');
        var permissionIndex = this.permissions.indexOf(permission.toLowerCase());
        if(permissionIndex === -1) throw('Unrecognized permission('+permission+')!');
        return groupIndex*this.permissions.length + permissionIndex;
    },
    hasPermission: function(context, permission){
        var position = this.getPosition(context, permission);
        return this.getBit(position);
    },
    setPermission: function(context, permission, value){
        var position = this.getPosition(context, permission);
        return this.setBit(position, value);
    },
    modify: function(clause){
        var operator = false;
        var subjects = [];
        var ch;
        if(typeOf(clause) == 'number') this.value = clause;
        for(var lcv=0; lcv < clause.length; lcv++){
            ch = clause.charAt(lcv);
            if(operator){
                var perm;
                switch(ch){
                    case 'r':
                        perm = 'read';
                        break;
                    case 'w':
                        perm = 'write';
                        break;
                    case 'x':
                        perm = 'execute';
                        break;
                }
                array.forEach(subjects, fn.bind(function(subject){
                    var value;
                    if(operator == '+') value = 1;
                    if(operator == '-') value = 0;
                    this.setPermission(subject, perm, value);
                }, this));
            }else{
                switch(ch){
                    case 'u':
                        subjects.push('user');
                        break;
                    case 'g':
                        subjects.push('group');
                        break;
                    case 'o':
                        subjects.push('world');
                        break;
                    case '+':
                    case '-':
                        operator = ch;
                        break;
                }
            }
        }
    }
});
ProtolusData.new = function(type){
    try{
        eval('this.lastProtolusObject = new GLOBAL.'+type+'();');
        var result = this.lastProtolusObject;
        delete this.lastProtolusObject;
        return result;
    }catch(ex){
        console.log(ex);
        throw('Object creation('+type+') error!');
    }
}
ProtolusData.WhereParser = new Class({
    blockOpen : '(',
    blockClose : ')',
    escapeOpen : '\'',
    escapeClose : '\'',
    sentinels : ['and', 'or', '&&', '||'],
    operators : ['=', '<', '>', '!'],
    textEscape : ['\''],
    parse : function(query){
        return this.parse_where(query);
    },
    parse_where : function(clause){
        var blocks = this.parse_blocks(clause);
        var phrases = this.parse_compound_phrases(blocks, []);
        var object = this;
        var mapFunction = function(value){
            if(type(value) == 'array'){
                return value.map(mapFunction);
            }else{
                if(array.contains(object.sentinels, value.toLowerCase())){
                    return {
                        type : 'conjunction',
                        value : value
                    }
                }else{
                    return object.parse_discriminant(value);
                }
            }
        };
        var parsed = phrases.map(mapFunction);
        return parsed;
    },
    parse_discriminant : function(text){
        var key = '';
        var operator = '';
        var value = '';
        var inQuote = false;
        var openQuote = '';
        var ch;
        for(var lcv=0; lcv < text.length; lcv++){
            ch = text[lcv];
            if(inQuote && ch === inQuote){
                inQuote = false;
                continue;
            }
            if( (!inQuote) && array.contains(this.textEscape, ch)){
                inQuote = ch;
                continue;
            }
            if(array.contains(this.operators, ch)){
                operator += ch;
                continue;
            }
            if(operator !== '') value += ch;
            else key += ch;
        }
        return {
            type : 'expression',
            key : key,
            operator : operator,
            value : value
        };
    },
    parse_blocks : function(parseableText){
        var ch;
        var env = [];
        var stack = [];
        var textMode = false;
        var text = '';
        var root = env;
        for(var lcv=0; lcv < parseableText.length; lcv++){
            ch = parseableText[lcv];
            if(textMode){
                text += ch;
                if(ch === this.escapeClose) textMode = false;
                continue;
            }
            if(ch === this.escapeOpen){
                text += ch;
                textMode = true;
                continue;
            }
            if(ch === this.blockOpen){
                if(text.trim() !== '') env.push(text);
                var newEnvironment = [];
                env.push(newEnvironment);
                stack.push(this.env);
                env = newEnvironment;
                text = '';
                continue;
            }
            if(ch === this.blockClose){
                if(text.trim() !== '') env.push(text);
                delete env;
                env = stack.pop();
                text = '';
                continue;
            }
            text += ch;
        }
        if(text.trim() !== '') env.push(text);
        return root;
    },
    parse_compound_phrases : function(data, result){
        array.forEach(data, fn.bind(function(item){
            var theType = type(item);
            if(theType == 'array'){
                var results = this.parse_compound_phrases(item, []);
                result.push(results);
            }else if(theType == 'string'){
                result = this.parse_compound_phrase(item);
            }
        }, this));
        return result;
    },
    parse_compound_phrase : function(clause){
        var inText = false;
        var escape = '';
        var current = '';
        var results = [''];
        var ch;
        for(var lcv=0; lcv < clause.length; lcv++){
            ch = clause[lcv];
            if(inText){
                results[results.length-1] += current+ch;
                current = '';
                if(ch === escape) inText = false;
            }else{
                if(array.contains(this.textEscape, ch)){
                    inText = true;
                    escape = ch;
                }
                if(ch != ' '){
                    current += ch;
                    if(array.contains(this.sentinels, current.toLowerCase())){
                        results.push(current);
                        results.push('');
                        current = '';
                    }
                }else{
                    results[results.length-1] += current;
                    current = '';
                }
            }
        }
        if(current != '') results[results.length-1] += current;
        if(results[results.length-1] === '') results.pop();
        return results;
    }
});
ProtolusData.Source = new Class({
    Implements : Options,
    initialize : function(options){
        this.setOptions(options);
        if(
            options.debug && 
            !(typeOf(options.debug) == 'string' && options.debug.toLowerCase() !== 'false')
        ) this.debug = true; 
        ProtolusData.sources[options.name] = this;
    },
    search : function(theType, query, options, callback){
        var successFunction = options.onSuccess;
        options.onSuccess = function(data){
            results = [];
            data.each(function(row){
                var dummy = Data.new(theType);
                dummy.data = row;
                results.push(dummy);
            });
            if(successFunction) successFunction(results);
        };
        var failureFunction = options.onFailure;
        options.onFailure = function(error){
            if(failureFunction) failureFunction(error);
        };
        
        this.query(theType, query, options, callback);
    },
    query : function(theType, query, options, callback){
        var dummy = ProtolusData.dummy(theType);
        theType = dummy.options.name;
        if(type(options) == 'function'){
            callback = options;
            options = {};
        }
        if(!options) options = {};
        var predicate = this.buildPredicate(query, options, dummy);
        return this.performSearch(theType, predicate, options, (callback || options.onSuccess), (
            options.onFailure || function(err){ console.log('['+'⚠ ERROR'+']:'+JSON.stringify(err)); }
        ));
    },
    handlePermissions: function(){
    
    },
    save: function(object, callback){
        return false;
    },
    escape: function(value){
        return value;
    },
    parseWhere: function(clause){
        //block parse
        //split off grouping/ordering
        //parse disriminants
    }
});
ProtolusData.Source.get = function(name){
    return ProtolusData.sources[name];
};
ProtolusData.Stream = new Class({
    Implements: Options,
    initialize : function(options){
        this.setOptions(options);
    },
    emit : function(options, callback){
        
    },
    on: function(type, callback){
        return value;
    }
});
ProtolusData.Stream.get = function(name){
    return ProtolusData.streams[name];
};
module.exports = ProtolusData;