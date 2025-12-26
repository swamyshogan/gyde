import {MongoClient} from 'mongodb';
import * as fs from 'fs';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_dev');
const sessionCollection = mongodb.collection('gyde_sessions');

for await (const d of sessionCollection.find({})) {
    delete d['_id'];
    const did = d.id;
    fs.writeFileSync(`../../gyde-dump/${did}.json`, JSON.stringify(d));
    console.log(d.id);
}

await mongo.close()
