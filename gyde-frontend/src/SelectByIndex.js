import React, {useState, useReducer, useCallback, useMemo} from 'react';

import {
    Button, TextField, Dialog, DialogTitle, DialogContent, DialogContentText, 
    DialogActions, Checkbox, Stack, MenuItem, LinearProgress, Grid
} from '@mui/material';

import { getPdbChains } from './utils/pdb';
import { parseStructureData } from './structureView/utils';
import { useGydeWorkerService } from './GydeWorkerService';
import { makeMappingsGeneric } from './utils/structureUtils';

export default function SelectByIndex({
    show,
    onHide,
    selection,
    seqColumns,
    seqColumnNames=[],
    alignments,
    columnarData,
    structureKeys=[],
    updateSelectedColumns
}) {
    const soloSelection = useMemo(() => {
        return selection?.size === 1 ? Array.from(selection)[0] : undefined;
    }, [selection]);

    const availStructureKeys = useMemo(() => {
        return structureKeys.filter((k) => !!columnarData[k] && !!columnarData[k][soloSelection])
    }, [soloSelection, structureKeys, columnarData]);

    const [structureKey, setStructureKey] = useState(null);
    const [chainMappings, setChainMappings] = useState(undefined);
    const [dataLoading, setDataLoading] = useState(false);
    const [dataErr, setDataErr] = useState(undefined);

    const [indexData, updateIndexData] = useReducer(
        (indexData, {chain, value}) => ({...indexData, [chain]: value}),
        {}
    );

    const gydeWorkerService = useGydeWorkerService();
    const selectStructure = useCallback(async (key) => {
        if (key === '-') {
            setStructureKey(undefined);
            setChainMappings(undefined);
            setDataErr(undefined);
            return;
        }

        try {
            setStructureKey(key);
            setDataLoading(true);
            setDataErr(undefined);
            setChainMappings(undefined);
            const structureData = columnarData[key][soloSelection];

            if (!structureData) return;
            const {structureText, format}  = await parseStructureData(structureData);
            if (format !== 'pdb' && format !== 'mmcif') {
                throw Error('Do not support ' + format);
            }
        
            const chains = await getPdbChains(structureText, format);

            const mappings = await makeMappings(
                gydeWorkerService,
                chains,
                seqColumns.map((s) => (columnarData[s.column] || [])[soloSelection]),
                structureData?._gyde_chains
            );
            mappings.mappings.forEach((m) => {
                if (!m) return;

                m.reverseIndex = {};
                m.forEach((r, i) => {
                    if (r && r.value) {
                        m.reverseIndex[r.value] = i;
                    }
                });
            });
            setChainMappings(mappings);
        } catch (err) {
            console.log(err);
            setDataErr(err.message || err);
        } finally {
            setDataLoading(false);
        }
    }, [columnarData, soloSelection]);

    const {chains, active} = useMemo(() => {
        const chains = [],
              active = [];

        seqColumns.forEach((c, i) => {
            let name = seqColumnNames[i] || `Sequence ${i+1}`;
            let isActive = false;
            if (!structureKey) {
                isActive = true;
            } else if (chainMappings && !dataLoading && !dataErr) {
                if (chainMappings.chains[i]) {
                    name = name + ` [${chainMappings.chains[i]}]`;
                    isActive = true;
                }
            }

            chains.push(name);  active.push(isActive);
        });

        return  {chains, active};
    }, [seqColumns, seqColumnNames, dataLoading, dataErr, chainMappings, structureKey]);

    const validity = useMemo(() => {
        const valid = {};
        chains.forEach((c, chainIndex) => {
            const mapping  = chainMappings ? chainMappings.mappings[chainIndex]?.reverseIndex : undefined;

            const vals = (indexData[c] || '').split(/[\s,;+]+/g).filter((s) => s);
            for (const v of vals) {
                const match = /^(-?\d+[A-Z]?)(-(-?\d+[A-Z]?))?$/.exec(v);
                if (!match) {
                    valid[c] = `Unexpected token ${v}`;
                    break;
                }
                if (mapping) {
                    if (typeof(mapping[match[1]]) !== 'number') {
                        valid[c] = `Chain does not contain ${match[1]}`;
                        break;
                    }
                    if (match[3] && typeof(mapping[match[3]]) !== 'number') {
                        valid[c] = `Chain does not contain ${match[3]}`;
                        break;
                    }
                }
            }
        });
        return valid;
    }, [chains, chainMappings, indexData]);

    const applySelection = useCallback(() => {
        chains.forEach((c, chainIndex) => {
            const vals = (indexData[c] || '').split(/[\s,;+]+/g).filter((s) => s).map((v) => {
                 const match = /^(-?\d+[A-Z]?)(-(-?\d+[A-Z]?))?$/.exec(v);
                 if (!match) throw Error('Unexpected parsing failure');
                 const vv = [match[1]];
                 if (match[3]) vv.push(match[3]);
                 return vv;
            });

            let indices, columnIndex;
            if (!structureKey) {
                indices = [];

                for (const vv of vals) {
                    if (vv.length === 1) {
                        indices.push(parseInt(vv[0]));
                    } else if (vv.length ===2) {
                        const a = parseInt(vv[0]), b = parseInt(vv[1]);
                        const min = Math.min(a, b), max = Math.max(a, b);
                        for (let i = min; i <= max; ++i) indices.push(i);
                    } else {
                        throw Error();
                    }
                }
                columnIndex = chainIndex;
            } else {
                const reverseIndex  = chainMappings ? chainMappings.mappings[chainIndex]?.reverseIndex : undefined;
                indices = [];
                if (reverseIndex) {
                    for (const vv of vals) {
                        const a = reverseIndex[vv[0]] ?? -1;
                        if (a < 0) throw Error();

                        if (vv.length === 1) {
                            indices.push(a+1)
                        } else if (vv.length === 2) {
                            const b = reverseIndex[vv[1]] ?? -1;
                            if (b < 0) throw Error();

                            const min = Math.min(a, b), max = Math.max(a, b);
                            for (let i = min; i <= max; ++i) indices.push(i+1);
                        } else {
                            throw Error();
                        }
                    }
                } 
                columnIndex = chainIndex;
            }

            const aliColumn = alignments[chainIndex];
            const ali = aliColumn[soloSelection];
            if (!ali) return;

            const gapMap = [-1];
            for (let c = 0; c < ali.length; ++c) {
                if (ali[c] && ali[c] !== '-') {
                    gapMap.push(c);
                } 
            }
            indices = indices.map((v) => gapMap[v] ?? -1).filter((v) => v >= 0);

            updateSelectedColumns(seqColumns[chainIndex].column, {op: 'set', column: indices});
        });

        onHide();
    }, [chains, chainMappings, seqColumns, indexData, structureKey, updateSelectedColumns, soloSelection]);

    function check(label, val) {
        return (
            <span style={{color: val < 90 ? 'red' : undefined}}>{label} {Math.round(val)}%</span>
        );
    }

    return (
        <Dialog open={show} onClose={onHide} aria-labelledby="sbi-dialog-title">
            <DialogTitle id="sbi-dialog-title">
                Select residues by index or residue number
            </DialogTitle>

            <DialogContent>
                <DialogContentText>
                    Select a structure below to specify residues by residue number,
                    or use "sequence indices" mode if your positions list is relative
                    to the reference sequence
                </DialogContentText>

                <TextField
                    id="sbi-structure-select"
                    label="Select structure"
                    value={structureKey ? structureKey : '-'}
                    style={{width: '100%'}}
                    margin='normal'
                    select
                    onChange={(ev) => selectStructure(ev.target.value)}
                >
                    <MenuItem value="-">- sequence indices -</MenuItem>
                    { availStructureKeys.map((k) => (

                        <MenuItem key={k} value={k}>{k}</MenuItem>
                    )) }
                </TextField>

                { dataErr
                  ? <div style={{color: 'red'}}>{ dataErr }</div>
                  : dataLoading 
                    ? <LinearProgress />
                    : <Grid container>
                         { chains.map((c, i) => (
                            <React.Fragment key={i}>
                                <Grid style={{marginTop: 'auto', color: active[i] ? undefined : 'gray'}} item xs={3}>
                                    { c }
                                    { (chainMappings && chainMappings.mappings[i])
                                      ? <div style={{fontSize: '70%'}}>
                                          {check('ID:', chainMappings.mappings[i].perc_identity)} /
                                          {check('Cov:', chainMappings.mappings[i].perc_coverage)}
                                        </div>
                                      : undefined }
                                </Grid>
                                <Grid item xs={9}>
                                    <TextField value={(active[i] ? indexData[c] : undefined) || ''}
                                               disabled={!active[i]}
                                               variant="standard"
                                               placeholder={structureKey ? "Residue numbers e.g. 1, 2, 80-82B" : "Sequence indices, e.g. 1, 2 5-9"}
                                               fullWidth
                                               error={!!validity[c]}
                                               helperText={validity[c]}                             
                                               onChange={(ev) => updateIndexData({chain: c, value: ev.target.value})} />
                                </Grid>
                            </React.Fragment>
                         )) }
                      </Grid> }

            </DialogContent>
            <DialogActions>
                <Button onClick={applySelection}
                        disabled={Object.keys(validity || {}).length > 0}>
                    Apply selection
                </Button>
                <Button onClick={onHide} color="secondary">
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}


async function makeMappings(gydeWorkerService, structureChains, sequences, chains) {
    const seqByChain = {},
          residueInfoByChain = {};

    for (const [chain, data] of Object.entries(structureChains)) {
        seqByChain[chain] = data.rawAtomicSequence;
        residueInfoByChain[chain] = data.rawNumbering;
    }

    const mappings = await makeMappingsGeneric(gydeWorkerService, seqByChain, residueInfoByChain, sequences, chains);
    return mappings;
}
