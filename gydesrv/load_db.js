import {MongoClient} from 'mongodb';
import * as fs from 'fs';

const MONGO_CONNECTION = process.env.GYDE_MONGO_CONNECTION || 'mongodb://localhost/';


const mongo = new MongoClient(MONGO_CONNECTION);
const mongodb = mongo.db('gydedb_prd');
const sessionCollection = mongodb.collection('gyde_sessions');

const files = fs.readdirSync('../../gyde-dump')
console.log('got', files.length)
let cnt = 0;
for (const f of files) {
    const d = JSON.parse(fs.readFileSync('../../gyde-dump/' + f, 'utf8'))
    await sessionCollection.insertOne(d)
    console.log(++cnt, f)
}

await mongo.close()
