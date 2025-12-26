import {MongoClient} from 'mongodb';
import * as fs from 'fs';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_dev');
const sessionCollection = mongodb.collection('gyde_sessions');

async function dumpCollection(name) {
    const result = [];
    const collection = mongodb.collection(name);
    for await (const d of collection.find({})) {
        delete d['_id'];
        result.push(d);
    }
    fs.writeFileSync('dump_' + name + '.json', JSON.stringify(result));
}

await dumpCollection('gyde_login');
await dumpCollection('gyde_actions');
await dumpCollection('gyde_jobcache_v2')

await mongo.close()
