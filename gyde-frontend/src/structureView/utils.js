import {gunzipSync, strFromU8} from 'fflate';

import { arrayCmp, arrayCmpDeep} from '../utils/utils';

export function gapPatternsMatch(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if ((a[i] === '-') !== (b[i] === '-')) return false;
    }
    return true;
}

export function selectionCmp(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
        if (a[i] === b[i]) continue;
        if (!a[i] || !b[i]) return false;
        if (a[i].size !== b[i].size) return false;
        for (const x of a[i]) {
            if (!b[i].has(x)) return false;
        }
    }

    return true;
}

export function structureInfoEqual(a, b) {
    if (a.url !== b.url) return false;
    if (a.structureKey !== b.structureKey) return false;
    if (!a.url && !b.url) {
        if (!arrayCmp(a.sequences, b.sequences)) return false;
        if (!arrayCmp(a.alignments, b.alignments)) return false;
    }
    if (!arrayCmp(a.explicitChains, b.explicitChains)) return false;
    if (!arrayCmpDeep(a.explicitMappings, b.explicitMappings)) return false;
    if (a.modelIndex !== b.modelIndex) return false;
    if (!arrayCmp(a.ligands, b.ligands)) return false;
    if (!arrayCmp(a.dnas, b.dnas)) return false;
    if (!arrayCmp(a.rnas, b.rnas)) return false;

    return true
}

let blobIdSeed = 0;

export function structureDataKey(urlOrData) {
    if (!urlOrData) return;

    if (typeof urlOrData == 'string') {
        return urlOrData
    }

    if (urlOrData._gyde_url) return urlOrData._gyde_url;

    if (urlOrData instanceof Blob) {
        if (!urlOrData._gyde_structure_blobid) {
            urlOrData._gyde_structure_blobid = `blob${++blobIdSeed}`;
        }
        return urlOrData._gyde_structure_blobid
    }
}

export function extractSequences(i, seqColumns, seqRefColumns, columnarData) {
    const seqs = [];
    for (let si = 0; si < seqColumns.length; ++si) {
        seqs.push((seqColumns[si].data || [])[i]);
    }

    return seqs;
}

export function extractAlignmments(i, seqColumns, dsAlignments, dsReferences) {
    const seqs = [];
    for (let si = 0; si < seqColumns.length; ++si) {
        const seq = (dsAlignments[si] || [])[i];

        seqs.push(seq);
    }
    
    return seqs;
}

export function extractLigands(i, ligandColumns) {
    if (ligandColumns && ligandColumns.length > 0) {
        return ligandColumns.map((c) => c && c[i]).filter((x) => x);
    }
}

export function mimeToStructureType(type) {
    if (type === 'chemical/x-mdl-molfile') {
        return 'sdf';
    } else if (type === 'chemical/x-mmcif') {
        return 'mmcif';
    } else {
        return 'pdb'
    }
}

export async function parseStructureData(structureData, progressCallback) {
    let structureText;
    let format = 'pdb';
    
    if (structureData instanceof Blob) {
        structureText = await structureData.text();
        format = mimeToStructureType(structureData.type);
        return {structureText, format};
    } 

    let url, mimeType = undefined, name;

    if (typeof(structureData) === "string") {
        url = structureData;
        const toks = url.split('/');
        name = toks[toks.length - 1];
    } else {
        url = structureData._gyde_url;
        mimeType = structureData._gyde_type;
    }

    const baseResponse = await fetch(url);
    if (!baseResponse.ok) {
        if (baseResponse.status === 500) {
            const body = await baseResponse.text();
            if (body.length > 5 && body.length < 100000) {
                throw Error('Could not fetch structure: ' + body.replace(/<[^>]+>/g, '').split('\n').filter((l) => l.length > 5)[0])
            }

        }
        throw Error('Could not fetch structure: ' + baseResponse.statusText)
    }

    const contentLength = baseResponse.headers.get('content-length') && parseInt(baseResponse.headers.get('content-length'));
    let download = 0;

    const sendProgress = () => {
        if (!progressCallback) return;
        let msg = '' + download;
        if (contentLength) {
            msg = msg + '/' + contentLength;
        }
        if (name) {
            msg = `${name}: ${msg}`;
        }
        progressCallback(msg);
    }

    const transformer = new window.TransformStream({  // Our current babel stack doesn't seem to know about this (?!).
        start(constroller) {},
        async transform(chunk, controller) {
            chunk = await chunk;
            download += chunk.length;
            sendProgress();
            controller.enqueue(chunk);
        },
        flush(controller) {
            if (progressCallback) progressCallback();
        }
    });

    const response = new Response(baseResponse.body.pipeThrough(transformer), {headers: baseResponse.headers});

    if (name?.endsWith('.gz')) {
        const structureZipped = await response.arrayBuffer();
        const decompress  = gunzipSync(new Uint8Array(structureZipped));
        structureText = strFromU8(decompress);
        name = name.substring(0, name.length - 3);
    } else {
        structureText = await response.text();
    }

    if (mimeType) {
        format = mimeToStructureType(mimeType);
    } else if (name?.endsWith('.sdf')) {
        format = 'sdf';
    } else if (name?.endsWith('.cif') || name?.endsWith('.mmcif')) {
        format = 'mmcif';
    } else {
        format = 'pdb';
    }

    return {structureText: structureText, format: format};
}

export async function getStructureBlob(structureData) {
    let structureBlob

    if (structureData instanceof Blob) {
        structureBlob = structureData
    } else if (typeof(structureData) === "string") {
        const response = await fetch(structureData);
        structureBlob = await response.blob()
    } else {
        const response = await fetch(structureData._gyde_url);
        structureBlob = await response.blob();
    }

    return structureBlob
}
