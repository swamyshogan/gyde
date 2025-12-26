import {MongoClient} from 'mongodb';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_prd');

const sessionCollection = mongodb.collection('gyde_sessions');
await sessionCollection.createIndex({id: 1});
await sessionCollection.createIndex({user: 1});
await sessionCollection.createIndex({scope: 1, user: 1, public: 1, _deleted: 1});
await sessionCollection.createIndex({id: 1, lastModified: 1, created: 1, name: 1, shared: 1, public: 1, user: 1, user_name: 1, description: 1, scope: 1, _deleted: 1});


const cacheCollection = mongodb.collection('gyde_jobcache_v2');
await cacheCollection.createIndex({digest: 1});

const columnDataCollection = mongodb.collection('gyde_columns');
await columnDataCollection.createIndex({sessionId: 1, columnName: 1})


const openLogCollection = mongodb.collection('gyde_open_log');
await openLogCollection.createIndex({sessionId: 1, user: 1})
await openLogCollection.createIndex({user: 1})

await mongo.close()
