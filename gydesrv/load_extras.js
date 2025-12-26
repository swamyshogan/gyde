import {MongoClient} from 'mongodb';
import * as fs from 'fs';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_prd');
const sessionCollection = mongodb.collection('gyde_sessions');

async function loadCollection(name) {
    const data = JSON.parse(fs.readFileSync('dump_' + name + '.json', 'utf8'));
    console.log(name, data.length);
    const collection = mongodb.collection(name);
    await collection.insertMany(data);
}

await loadCollection('gyde_login');
await loadCollection('gyde_actions');
await loadCollection('gyde_jobcache_v2')

await mongo.close()
