var Data = require('./protolus-data');
Data.Source.MySQL = require('./sources/mysql');
var User = require('User');
var LocalMySQL = new Data.Source.MySQL({
    name : 'database',
    host : 'localhost',
    user : 'root',
    //password : '',
    database : 'protolus'
});

var user = new User();
user.set('first_name', 'dsadsdsa');
user.save(function(){
    console.log('data', user.data);
});