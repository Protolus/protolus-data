var Data = require('./protolus_data');
var Data.Source.MySQL = require('./sources/mysql');
var User = require('User');
var LocalMySQL = new Data.Source.MySQL({
    name : 'database',
    host : 'localhost',
    user : 'root',
    //password : '',
    database : 'protolus'
});

var user = new User();