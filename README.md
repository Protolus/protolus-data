protolus-data.js
===========

A Node.js data layer supporting a variety of data sources using a single SQL based query syntax

Usage
-----
while the features are relatively stable, there will likely be a revision to the way a class is defined.

Datasources are registered by creating an entry in the configuration

Let's say you want to create a class to represent alien invaders (in this case Red 'Lectroids) containing a few fields('ganglia_state', 'institutionalized', 'ship_completeness', 'origin_dimension'), you'd name your file based on your classname in the 'Classes' directory, such as 'RedLectroid.js'.

an example looks like:

    new Class({
        Extends : Data,
        initialize : function(options){
            //if options comes in as a string, we assume it's the key we're selecting (AKA 'id')
            if(typeOf(options) == 'string') options = {key:options};
            if(!options) options = {};
            //link this to a particular datasource (defined in your configuration)
            options.datasource = 'myAwesomeDatasource';
            //this is the storage location for this object (think table or collection name)
            options.name = 'red_lectroid';
            this.fields = [
                'ganglia_state',
                'institutionalized',
                'ship_completeness',
                'origin_dimension'
            ];
            this.primaryKey = 'id';
            this.parent(options);
            if(options.key) this.load(options.key);
        }
    });
    
You would use this class like this:

    var DrEmilioLizardo = new RedLectroid();
    DrEmilioLizardo.set('ganglia_state', 'twitching');
    DrEmilioLizardo.set('institutionalized', true);
    DrEmilioLizardo.set('ship_completeness', 0.90);
    DrEmilioLizardo.set('origin_dimension', 8);
    DrEmilioLizardo.save();
    
And you would search for a set using:

    Data.search('RedLectroid', "institutionalized == true");
    
or if you only wanted the data payload (not a set of objects)

    Data.query('RedLectroid', "institutionalized == true");
    
One thing to note: This data layer is designed to discourage both streaming data sets and joins. If you need these features or you find this level of indirection uncomfortable you should probably manipulate the DB directly and skip the whole data layer (or even better, interface with an API). 

Other Datasource specific features (for example MapReduce under mongo) must be accessed from the DB driver which may be accessed directly:

    Datasource.get('myAwesomeDatasource').connection;

But when you do this you are circumventing the data layer (other than letting protolus negotiate the connection for you).