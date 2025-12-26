function exclusionSet(session) {
    const columnExclusions = new Set();
    for (const ac of session.msaColumns || []) {
        columnExclusions.add(ac.column);
    }
    for (const ac of session.abNumColumns || []) {
        columnExclusions.add(ac.column);
    }
    for (const ac of session.abNumRefColumns || []) {
        columnExclusions.add(ac.column);
    }
    return columnExclusions;
}

function setwiseMergeArrays(...arrays) {
    const result = [],
          seen = new Set();
    for (const a of arrays) {
        if (a) {
            for (const i of a) {
                if (!seen.has(i)) {
                    result.push(i);
                    seen.add(i);
                }
            }
        }
    }
    return result;
}

export function columnTypesFromSession(session) {
    const columnTypes = {...(session.columnTypes || '')};

    for (const s of session.seqColumns) {
        if (s && s.column) {
            if (session.hcColumn === s.column) {
                columnTypes[s.column] = 'hc';
            } else if (session.lcColumn === s.column) {
                columnTypes[s.column] = 'lc';
            } else {
                columnTypes[s.column] = 'protein';
            }
        }
    }

    for (const s of session.structureKeys) {
        columnTypes[s] = 'structure';
    }

    for (const u of session.analysisImageFields) {
        columnTypes[u] = 'image';
    }

    return columnTypes;
}

export function swizzleColumnNames(session, swizzle) {
    const newData = {};
    for (const [k, v] of Object.entries(session.columnarData)) {
        newData[swizzle[k] ?? k] = v;
    }

    function swizzleNames(n) {
        if (!n) return n;
        return n.map((c) => swizzle[c] ?? c);
    }

    function swizzleSeqs(n) {
        if (!n) return n;
        return n.map((col) => col?.column ? {...col, column: swizzle[col.column] ?? col.column} : col);
    }

    function swizzleOne(n) {
        if (!n) return n;
        return swizzle[n] ?? n;
    }

    return {
        ...session,
        columnarData: newData,
        dataColumns: swizzleNames(session.dataColumns),
        analysisImageFields: swizzleNames(session.analysisImageFields),
        dataFields: swizzleNames(session.dataFields),
        msaDataFields: swizzleNames(session.msaDataFields),
        structureKeys: swizzleNames(session.structureKeys),
        seqColumns: swizzleSeqs(session.seqColumns),
        seqRefColumns: swizzleSeqs(session.seqRefColumns),
        msaColumns: swizzleSeqs(session.msaColumns),
        abNumColumns: swizzleSeqs(session.abNumColumns),

        lcColumn: swizzleOne(session.lcColumn),
        hcColumn: swizzleOne(session.hcColumn)
    }
}

export function cbind(thisSession, extSession, duplicateRules={}) {
    const thisExclusions = exclusionSet(thisSession),
          extExclusions = exclusionSet(extSession);
    extExclusions.add('_gyde_rowid');

    const newData = {};
    const dataColumns = [...thisSession.dataColumns].filter((c) => !thisExclusions.has(c));

    const totalExtRows = extSession.dataRowCount;
    let extIndices = [];
    for (let i = 0; i < totalExtRows; ++i) extIndices[i] = i;
    for (const [k, v] of Object.entries(duplicateRules)) {
        if (v === 'discard') {
            const old = new Set(thisSession.columnarData[k] || []);
            const ext = extSession.columnarData[k] || [];
            extIndices = extIndices.filter((i) => !old.has(ext[i]));
        }
    }

    const n = thisSession.dataRowCount, m = extIndices.length, mn = m+n;
    let rowIDSeed = thisSession.rowIDSeed || 0;

    for (const [key, value] of Object.entries(thisSession.columnarData)) {
        if (!thisExclusions.has(key)) {
            newData[key] = [...value];
        }
    }
    for (const [key, value] of Object.entries(extSession.columnarData)) {
        if (!extExclusions.has(key)) {
            if (dataColumns.indexOf(key) < 0) {
                dataColumns.push(key);
            }
            if (!newData[key]) {
                newData[key] = new Array(n);
            }

            if (duplicateRules[key] === 'disambiguate') {
                const seen = new Set(newData[key]);
                for (let i = 0; i < m; ++i) {
                    let v = value[extIndices[i]];
                    if (seen.has(v)) {
                        for (let i = 2; ; ++i) {
                            const t = '' + v + '_' + i;
                            if (!seen.has(t)) {
                                v = t; 
                                break;
                            }
                        }                        
                    }
                    newData[key][i+n] = v;
                }
            } else {
                for (let i = 0; i < m; ++i) {
                    newData[key][i+n] = value[extIndices[i]];
                }
            }
        }
    }

    if (!newData._gyde_rowid) {
        newData._gyde_rowid = [];
        for (let i = 0; i < n; ++i) {
            newData._gyde_rowid[i] = `r${rowIDSeed++}`;
        }
    }
    for (let i = 0; i < m; ++i) {
        newData._gyde_rowid[n+i] = `r${rowIDSeed++}`;
    }

    const merged = {
        ...thisSession,
        
        columnarData: newData,
        dataRowCount: mn,
        dataColumns,
        rowIDSeed
    };
    merged.msaColumns = undefined;
    merged.abNumColumns = undefined;
    merged.abNumRefColumns = undefined;
    merged.storedAlignment = undefined;

    return merged;
}

export function rbind(thisSession, extSession, thisKey, extKey, joinType='left', clashActions={}) {
    const leftInclusive = joinType === 'left' || joinType === 'full',
          rightInclusive = joinType === 'right' || joinType === 'full';

    const dataColumns = [...thisSession.dataColumns],
          columnTypes = {...thisSession.columnTypes};
    let resetAlignments = false;

    const thisKeyData = thisSession.columnarData[thisKey] || [],
          thisIx = {};
    thisKeyData.forEach((v, i) => {
        thisIx[v] = i;
    });

    const extKeyData = extSession.columnarData[extKey] || [],
          extIx = {};
    extKeyData.forEach((v, i) => {
        extIx[v] = i;
    });

    const leftMatched = thisKeyData.map((k) => extIx[k] !== undefined),
          rightMatched = extKeyData.map((k) => thisIx[k] !== undefined);

    let dataRowCount = leftInclusive ? thisSession.dataRowCount : leftMatched.filter((x) => x).length;
    let rowIDSeed = thisSession.rowIDSeed || 0;
    const newData = {};
    for (const [k, v] of Object.entries(thisSession.columnarData)) {
        if (leftInclusive) {
            newData[k] = [...v];
        } else {
            const nv = v.filter((_, i) => leftMatched[i]);
            if (nv.length < v.length) resetAlignments = true;
            newData[k] = nv;
        }
    }

    const thisKeyDataMatched = newData[thisKey]

    const boundColumns = new Set();
    for (const [k, v] of Object.entries(extSession.columnarData)) {
        if (k === extKey) {
            if (rightInclusive) {
                const newColumn = newData[thisKey];
                let xi = dataRowCount;
                rightMatched.forEach((m, i) => {
                    if (!m) newColumn[xi++] = v[i];
                });
            }
            continue;
        }

        let newColumn;
        if (newData[k]) {
            if (clashActions[k] === 'fill') {
                newColumn = newData[k]
                for (let i = 0; i < thisKeyDataMatched.length; ++i) {
                    const ix = extIx[thisKeyDataMatched[i]];
                    if (ix !== undefined) {
                        if (newColumn[i] === null || newColumn[i] === undefined || newColumn[i] === '') {
                            newColumn[i] = v[ix];
                        }
                    }
                }
            } else {
                continue;
            }
        } else {
            newColumn = new Array(dataRowCount);
            newData[k] = newColumn;
            for (let i = 0; i < thisKeyDataMatched.length; ++i) {
                const ix = extIx[thisKeyDataMatched[i]];
                if (ix !== undefined) {
                    newColumn[i] = v[ix];
                }
            }
            dataColumns.push(k);
            
            if ((extSession.columnTypes || {})[k]) {
                columnTypes[k] = extSession.columnTypes[k];
            }
        }

        if (rightInclusive) {
            let xi = dataRowCount;
            rightMatched.forEach((m, i) => {
                if (!m) newColumn[xi++] = v[i];
            });
        }

        boundColumns.add(k);
    }

    const seqColumns = [...(thisSession.seqColumns || [])],
          seqRefColumns = [...(thisSession.seqRefColumns || [])],
          extSeqColumns = extSession.seqColumns || [],
          extSeqRefColumns = extSession.seqRefColumns || [],
          extSeqColumnNames = extSession.seqColumnNames;

    let seqColumnNames = thisSession.seqColumnNames ? [...thisSession.seqColumnNames] : undefined;

    {
        const thisSeqColumnCount = seqColumns.length;
        let extraSeqColumns = 0;
        for (let i = 0; i < extSeqColumns.length; ++i) {
            if (boundColumns.has(extSeqColumns[i]?.column)) {
                seqColumns[thisSeqColumnCount+extraSeqColumns] = extSeqColumns[i]
                seqRefColumns[thisSeqColumnCount+extraSeqColumns] = extSeqRefColumns[i];

                if (extSeqColumnNames && extSeqColumnNames[i]) {
                    if (!seqColumnNames) seqColumnNames=[];
                    seqColumnNames[thisSeqColumnCount+extraSeqColumns] = extSeqColumnNames[i];
                }

                ++extraSeqColumns;
                resetAlignments = true;
            }
        }
    }

    if (rightInclusive) {
        const rightExtra = rightMatched.filter((x) => !x).length;
        for (let i = 0; i < dataRowCount; ++i) {
            newData._gyde_rowid[dataRowCount+i] = `r${rowIDSeed++}`;
        }
        if (rightExtra) resetAlignments = true;
        dataRowCount += rightExtra;
    }

    const merged = {
        ...thisSession,
        
        columnarData: newData,
        dataRowCount,
        columnTypes,
        dataColumns,
        rowIDSeed,
        seqColumns,
        seqRefColumns,
        seqColumnNames,
        selection: undefined,   // Should we keep (but filter?)
        structureKeys: setwiseMergeArrays(thisSession.structureKeys, extSession.structureKeys),

        dataFields: setwiseMergeArrays(thisSession.dataFields, extSession.dataFields),
        msaDataFields: setwiseMergeArrays(thisSession.msaDataFields, extSession.msaDataFields)
    };

    if (resetAlignments) {
        merged.msaColumns = undefined;
        merged.abNumColumns = undefined;
        merged.abNumRefColumns = undefined;
        merged.storedAlignment = undefined;
    }

    return merged;
}