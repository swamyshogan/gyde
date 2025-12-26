const proxy = require('http-proxy-middleware');
const uuid = require('uuid');
const bodyParser = require('body-parser');
const multiparty = require('multiparty');
const fs = require('fs');

const GYDESRV = process.env.GYDESRV_URL || 'http://localhost:3030';
const SLIVKA = process.env.SLIVKA_URL || GYDESRV || 'http://localhost:3030';

const ENVIRONMENT = {
    type: 'local',
    featureFlags: {
        boltz: true,
        boltz1x: true,
        boltz2: true,
        chai: true,
        chaiLab: true,
        of3: true,
        of3v1: true,
        ibex: true,
        nimStructurePredictions: true,
        collabServerMSAs: (process.env.GYDE_USE_COLLABFOLD_SERVER ?? '0') === '1',

        ligandMPNN: true,

        useCaseHelp: true
    }
}

module.exports = function(app) {

    const store = {},
          pingLog = [];

    try {
        const ents = fs.readdirSync('test-datasets');
        for (const f of ents) {
            if (f[0] !== '.' && f.endsWith('.json')) {
                store[f.substring(0, f.length - 5)] = JSON.parse(fs.readFileSync(`test-datasets/${f}`, 'utf8'));
            }
        }
    } catch (err) {
        console.log('failed to read test-datasets');
    }

    app.get('/environment', (req, res) => {
        res.type('json').send(JSON.stringify(ENVIRONMENT))
    });

    app.use(
        '/token',
        (req, resp) => { 
            resp.type('json').send(JSON.stringify({token: process.env.GYDE_TOKEN}))      
        }
    );

    app.use(
        '/gas',
        proxy.createProxyMiddleware({
            target: GYDESRV,              // Only likely to work internally, but harmless otherwise.
            pathRewrite: {'^/gas': '/'},
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/api',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/media',
        proxy.createProxyMiddleware({
            target: SLIVKA,
            changeOrigin: true,
            secure: false
        })
    );
    // We can't sensibly override SLIVKA2 since it requires content re-writes in gydesrv,
    // which we don't want to replicate here....
    app.use(
        '/api2',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/media2',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false

        })
    );
    app.use(
        '/cache/structure',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/cache/efstructure',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/data',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false
        })
    );
    app.use(
        '/prescient',
        proxy.createProxyMiddleware({
            target: GYDESRV,
            changeOrigin: true,
            secure: false
        })
    );

    app.use(
        '/v1/biology',
        proxy.createProxyMiddleware({
            target: 'https://health.api.nvidia.com/',
            changeOrigin: true,
            secure: false
        })
    );

    app.get(
        '/user-info',
        (req, resp) => { 
            resp.send(JSON.stringify({
                'name': 'Test User',
                'username': 'usert',
                'roles': ['test-server', 'gred-data-sources']
            }))
        }
    );

if (process.env.GYDE_PROXY_STORE) {

    app.use(
        '/store',
        proxy.createProxyMiddleware({
            target: process.env.GYDE_PROXY_STORE,
            changeOrigin: true
        })
    );
} else {

    app.get(
        '/store',
        (req, resp) => {
            resp.type('json').send(JSON.stringify(Object.entries(store).map(([id, data]) => ({
                id,
                name: data.name,
                lastModified: data.lastModified,
                openTime: data.openTime,
                shared: !!data.shared,
                public: !!data.public,
                description: data.description,
                user_name: 'Test user',
                user: 'usert'
            }))));
        }
    );


    app.post(
        '/store',
        bodyParser.json({limit: '500mb', debug: true}),
        (req, resp) => { 
            const id = uuid.v4();
            const timestamp = new Date().toISOString();
            store[id] = {...req.body, created: timestamp, lastModified: timestamp};
            resp.type('json').send(JSON.stringify({'id': id, timestamp}));
        }
    );


    app.post(
        '/store/:id',
        bodyParser.json({limit: '500mb'}),
        async (req, resp) => {
            const id = req.params.id;
            if (Math.random() < 0.0) {
                await pause(1000);
                resp.status(500).send('err');
            } else {
                if (store[id]) {
                    const timestamp = new Date().toISOString();
                    const {
                        columnarData: columnarDataUpdate,
                        encodedBlobColumns: ebcUpdate,
                        objColumns: objUpdate,
                        ...update
                    } = req.body;
                    if (columnarDataUpdate) {
                        update.columnarData = {...store[id].columnarData, ...columnarDataUpdate};
                    }
                    if (ebcUpdate) {
                        update.encodedBlobColumns = {...store[id].encodedBlobColumns, ...ebcUpdate}
                    }
                    if (objUpdate) {
                        update.objColumns = {...store[id].objColumns, ...objUpdate}
                    }
                    store[id] = {...store[id], ...update, lastModified: timestamp};
                    resp.type('json').send('{"status": "OK"}');
                } else {
                    resp.status(404).send('not found');
                }
            }
        }
    );


    app.get(
        '/store/:id',
        async (req, resp) => {
            const id = req.params.id;
            if (store[id]) {
                await pause(1000);
                store[id].openTime = new Date().toISOString();
                resp.type('json').send(JSON.stringify(store[id]));
            } else {
                resp.status(404).send('not found')
            }
        }
    );

    app.delete(
        '/store/:id',
        (req, resp) => {
            const id = req.params.id;
            delete store[id];
            resp.type('json').send('{"status": "OK"}')
        }
    )

    app.post(
        '/send-to-gyde',
        (req, res) => {
            const formParser = new multiparty.Form();
            formParser.parse(req, async (err, fields, files) => {
                const file = ((files || {})['session_data'] || [])[0];
                if (!file) {
                    res.send('no data');
                    return;
                }

                let postData = JSON.parse(fs.readFileSync(file.path, 'utf8'));

                if (postData.data) {
                    postData = promoteV1000(postData);
                } else if (postData.columnarData) {
                    postData._gyde_format_version = 100000;
                } else {
                    res.send('bad format')
                    return;
                }

                const id = uuid.v4();
                const timestamp = new Date().toISOString();
                const body = {...postData};
                delete body['_gyde_readonly'];

                store[id] = {...body, created: timestamp, lastModified: timestamp};

                res.redirect(`/?load_session=${id}`)

            });
        }
    );


    app.post(
        '/ping',
        bodyParser.json(),
        (req, res) => {
            pingLog.push({time: new Date(), user: 'usert', type: req.body.action || 'unknown', detail: req.body.detail});
            res.send('OK');
        }
    );

    app.get(
        '/special/action-log',
        (req, res) => {
            const logRecords = [['username', 'time', 'action'].join('\t')];
            for (const record of pingLog) {
                logRecords.push([record.user, record.time?.toISOString() ?? '', record.type].join('\t'));
            }

            res.set({
                'content-type': 'text/tab-separated-values',
                'content-disposition': 'attachment; filename="gyde-actions.tsv'
            }).send(logRecords.join('\n'));
        }
    );
 
    // app.use('/prescient-rounds', (req, res) => {res.status(403).send('test...')})
}

}


function promoteV1000(postData) {
    const {
        data,
        dataColumns,
        alignedHeavy, alignedHeavyRN,
        alignedLight, alignedLightRN,
        anarciHeavy, anarciHeavyRN,
        anarciLight, anarciLightRN,
        selection,
        heavySelectedColumns,
        lightSelectedColumns,
        filter,
        encodedBlobs,
        ...sessionProps
    } = postData;

    data.columns = dataColumns;
    if (alignedHeavy) alignedHeavy.residueNumbers = alignedHeavyRN;
    if (alignedLight) alignedLight.residueNumbers = alignedLightRN;
    if (anarciHeavy) anarciHeavy.residueNumbers = anarciHeavyRN;
    if (anarciLight) anarciLight.residueNumbers = anarciLightRN;

    /* We don't support encoded blobs for s2g at the moment.
    const blobCache = (encodedBlobs || []).map(({data, type}) => {
        const props = {};
        if (type) props.type = type;
        return new Blob([toByteArray(data).buffer], props);
    });

    for (const d of data) {
        for (const [k, v] of Object.entries(d)) {
            if (v && v._gyde_blob_) {
                if (typeof(v._gyde_blob_.index) === 'number') {
                    d[k] = blobCache[v._gyde_blob_.index];
                } else {
                    const props = {};
                    if (v._gyde_blob_.type) props.type = v._gyde_blob_.type;
                    d[k] = new Blob([toByteArray(v._gyde_blob_.data).buffer], props);
                }
            }
        }
    }
    */

    if (!sessionProps.seqColumns) {
        sessionProps.seqColumns = [];
        if (data.columns.indexOf('HC_sequence') >= 0) sessionProps.seqColumns.push('HC_sequence');
        if (data.columns.indexOf('LC_sequence') >= 0) sessionProps.seqColumns.push('LC_sequence');
    }

    const columnarData = aosToSoaInclusive(data);

    if ((sessionProps.dataFields || []).indexOf('Names') < 0) {
        sessionProps.dataFields = ['Names', ...(sessionProps.dataFields || [])];
    }

    if ((sessionProps.msaDataFields || []).indexOf('Names') < 0) {
        sessionProps.msaDataFields = ['Names', ...(sessionProps.msaDataFields || [])];
    }

    if (!sessionProps.seqColumns) {
        sessionProps.seqColumns = [];
        if (columnarData['HC_sequence']) sessionProps.seqColumns.push('HC_sequence');
        if (columnarData['LC_sequence']) sessionProps.seqColumns.push('LC_sequence');
    }
    sessionProps.seqColumns = sessionProps.seqColumns.map((column) => ((column instanceof String) ? ({column}) : column));

    if (alignedLight || alignedHeavy) {
        sessionProps.msaColumns = sessionProps.seqColumns.map(({column}) => {
            let align = null;
            if (column === 'HC_sequence') align = alignedHeavy;
            if (column === 'LC_sequence') align = alignedLight;
            if (align) {
                const msaColName = '_gyde_msa_' + column;
                columnarData[msaColName] = align.map(({seq}) => seq);
                return {
                    column: msaColName,
                    numbering: align.residueNumbers
                };
            }
        });
    }

    return {
        ...sessionProps,
        storedAlignment: null,    // We always want to re-run numbering alignments on Ab datasets.
        columnarData,
        dataColumns,
        dataRowCount: data.length,
        _gyde_format_version: 100000
    }
}

function aosToSoa(aos) {
    const soa = {};
    for (const k of Object.keys(aos[0])) {
        soa[k] = aos.map((x) => x[k]);
    }
    return soa;
}

function aosToSoaInclusive(aos) {
    const allKeys = Object.keys(aos[0]);
    for (const s of aos) {
        for (const k of Object.keys(s)) {
            if (allKeys.indexOf(k) < 0) allKeys.push(k);
        }
    }

    const soa = {};
    for (const k of allKeys) {
        soa[k] = aos.map((x) => x[k]);
    }
    return soa;
}


function soaToAos(soa) {
    const aos = [],
          keys = Object.keys(soa),
          length = soa[keys[0]].length;

    for (let i = 0; i < length; ++i) {
        const obj = {};
        for (const k of keys) obj[k] = soa[k][i];
        aos.push(obj);
    }
    return aos;
}

function pause(time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), time);
    });
}
