import {MongoClient} from 'mongodb';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_dev');
const sessionCollection = mongodb.collection('gyde_login');

for await (const d of sessionCollection.find({})) { console.log([d.timestamp, d.user, d.name].join('\t')); }
await mongo.close();
