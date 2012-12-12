var should = require("should");
var Data = require('./protolus-data');
Data.require('User');
Data.require('Thing');

//todo: do build-up & tear down of datasources
describe('Protolus.Data', function(){
    //*
    describe('uses MySQL to', function(){
        Data.Source.MySQL = require('./sources/mysql');
        var connection;
        var id;
        before(function(){
            connection = new Data.Source.MySQL({
                name : 'database',
                host : 'localhost',
                user : 'root',
                //password : '',
                database : 'protolus'
            });
        });
        
        it('save an object', function(done){
            var user = new User();
            user.set('first_name', 'Abbey');
            user.set('last_name', 'Sparrow');
            user.set('email', 'foo@bar.com');
            user.save(function(){
                id = user.get('id');
                should.exist(user.get('id'));
                done();
            });
        });
        
        it('load and alter an object without saving a new one', function(done){
            var user = new User();
            user.load(id, function(){
                user.set('first_name', 'blah');
                user.save(function(){
                    id.should.equal(user.get('id'));
                    var reloadedUser = new User();
                    reloadedUser.load(user.get('id'), function(){
                        reloadedUser.get('first_name').should.equal('blah');
                        done();
                    });
                });
            });
        });
        
        it('select a set of objects >= to the one we created', function(done){
            Data.query('User', 'id >= '+id, function(results){
                results.length.should.equal(1);
                done();
            });
        });
    });
    //*/
    
    //*
    describe('uses MongoDB to', function(){
        Data.Source.MongoDB = require('./sources/mongo');
        var connection;
        var id;
        before(function(){
            connection = new Data.Source.MongoDB({
                name : 'mongo_ds',
                host : 'localhost',
                database : 'protolus'
            });
        });
        
        it('save an object', function(done){
            var thing = new Thing();
            thing.set('worg', 'Abbey');
            thing.set('field', 'Sparrow');
            thing.set('company', 'foo@bar.com');
            thing.save(function(){
                id = thing.get('id');
                should.exist(thing.get('_id'));
                should.exist(id); //virtual makes '_id' > 'id'
                done();
            });
        }); 
        
        it('load and alter an object without saving a new one', function(done){
            var thing = new Thing();
            thing.load(id, function(){
                thing.set('field', 'blah');
                thing.save(function(){
                    id.toString().should.equal(thing.get('id').toString());
                    done();
                });
            });
        });
        
        it('select a set of objects >= to the one we created', function(done){
            Data.query('Thing', 'id == '+id, function(results){
                console.log('aa', results);
                //results.length.should.equal(1);
                //done();
            });
        });
        
    });
    //*/
    
    //describe('uses AMQP to');
});