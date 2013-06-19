protolus-data.js
===========

A Node.js data layer supporting mysql/mongo/rabbit using a single SQL based query syntax

Usage
-----

First you'll need to register at least one datasource:

    var MySQLDatasource = require('protolus-data/sources/mysql');
    new MySQLDatasource({
        name : 'maindatabase',
        host : 'localhost',
        user : 'dbuser',
        password : 'P455W0RD',
        database : 'mysqldbname'
    });
    

The basic data pattern looks like:

    var Data = require('protolus-data');
    var MyObject = Data.Container({
        initialize : function MyObject(key){
            this.fields = [
                'id',
                'somefield',
                'anotherfield'
            ];
            this.parent({
                name : 'user',
                datasource : 'maindatabase'
            });
            if(key) this.load(key);
        }
    });
    Data.register('MyObject', MyObject);
    module.exports = MyObject;
    
You would use this class like this:

    var MyObject = Data.require('MyObject');
    var myInstance = new MyObject();
    myInstance.set('somefield', 'somevalue');
    myInstance.set('anotherfield', 49);
    myInstance.save();
    
And you would search for a set using:

    Data.search('MyObject', "somefield == 'searchvalue' || (somefield > 24 && somefield < 38)");
    
or if you only wanted the data payload (not a set of objects)

    Data.query('MyObject', "somefield == 'searchvalue' || (somefield > 24 && somefield < 38)");
    
One thing to note: This data layer is designed to discourage both streaming data sets and joins while normalizing query syntax across datasources. If you need these features or you find this level of indirection uncomfortable you should probably manipulate the DB directly and skip the whole data layer (or even better, interface with an API). 

Virtuals
--------
Sometimes you want to address a field as another field (we use this feature with mongo so you can address the primary key as 'id' rather than '_id'), but you want that reference to be symbolic as far as the DB is concerned. This is simply accomplished:

    object.virtualAlias(virtualName, fieldName);
    
Direct Access
-------------

Other Datasource specific features (for example MapReduce under mongo) must be accessed from the DB driver which may be accessed directly:

    var Data = require('protolus-data');
    Data.Source.get('myAwesomeDatasource').connection;

But when you do this you are circumventing the data layer (other than letting protolus negotiate the connection for you).

Testing
-------
Tests use mocha/should to execute the tests from root

    mocha

If you find any rough edges, please submit a bug!

Enjoy,

-Abbey Hawk Sparrow