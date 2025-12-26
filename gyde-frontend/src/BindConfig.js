import React, {useState, useReducer, useMemo, useEffect} from 'react';

import { Grid, ButtonGroup, Button, TextField, MenuItem, FormControlLabel, Select, Paper, Tooltip } from '@mui/material';
import { AddRoad as AddColumns, PlaylistAdd as AddRows,
         JoinFull, JoinInner, JoinLeft, JoinRight } from '@mui/icons-material';


import DatasetPreview from './DatasetPreview';
import {cbind, rbind, columnTypesFromSession, swizzleColumnNames} from './binder';

function validateJoinKey(column) {
    if (!column) {
        return 'Bad column';
    }
    const seen = new Set();
    for (const v of column) {
        if (!v || v === '') {
            return 'Column has missing values'
        }
        if (seen.has(v)) {
            return `Column has duplicate values, e.g. ${v}`
        }
        seen.add(v);
    }
}

// NB embedders should use "key" or another mechanism to ensure this gets
// recreated if the sessions change.
export default function BindConfig({thisSession, extSession, resultCallback}) {
    const [direction, setDirection] = useState('cols');

    const [rJoinType, setRJoinType] = useState('left');
    const [rJoinLeftKey, setRJoinLeftKey] = useState(() => {
        if (thisSession.nameColumn && thisSession.columnarData[thisSession.nameColumn]) {
            return thisSession.nameColumn;
        } else if (thisSession.columnarData.concept_name) {
            return 'concept_name';
        } else if (thisSession.columnarData.seqid) {
            return 'seqid';
        } else {
            return thisSession.dataColumns[0]
        }
    });
    const [rJoinRightKey, setRJoinRightKey] = useState(() => {
        if (extSession.nameColumn && extSession.columnarData[extSession.nameColumn]) {
            return extSession.nameColumn;
        } else if (extSession.columnarData.concept_name) {
            return 'concept_name';
        } else if (extSession.columnarData.seqid) {
            return 'seqid';
        } else {
            return extSession.dataColumns[0]
        }
    });

    const [nameSwizzle, updateNameSwizzle] = useReducer((oldNameSwizzle, {column, name}) => ({
        ...oldNameSwizzle,
        [column]: name
    }), {});

    const [clashActions, updateClashAction] = useReducer((oldActions, {column, action}) => ({
        ...oldActions,
        [column]: action
    }), {});

    const [nameClashAction, setNameClashAction] = useState('disambiguate');

    const rJoinLeftKeyValid = useMemo(
        () => validateJoinKey(thisSession.columnarData[rJoinLeftKey]),
        [thisSession.columnarData[rJoinLeftKey]]
    );

    const rJoinRightKeyValid = useMemo(
        () => validateJoinKey(extSession.columnarData[rJoinRightKey]),
        [extSession.columnarData[rJoinRightKey]]
    );

    const thisColumnTypes = useMemo(() => columnTypesFromSession(thisSession), [thisSession]),
          extColumnTypes = useMemo(() => columnTypesFromSession(extSession), [extSession]);

    const incompatibleAntibodyness = useMemo(() => {
        if (direction === 'rows') {
            if ((!!extSession.hcColumn ^ !!thisSession.hcColumn) ||
                (!!extSession.lcColumn ^ !!thisSession.lcColumn)) {
               return 'Cannot add rows between antibody and non-antibody datasets';
            }
        } else if (direction === 'cols') {
            if ((extSession.hcColumn && thisSession.hcColumn) ||
                (extSession.lcColumn && thisSession.lcColumn))
            {
                return 'Cannot (currently) add columns to create datasets with multiple antibody sequence columns';
            }
        }
    }, [direction]);

    const [specialColumnSwizzle, scsErrors] = useMemo(() => {
        const specialColumnSwizzle = {},
              scsErrors = [];

        if (thisSession.hcColumn && extSession.hcColumn && thisSession.hcColumn !== extSession.hcColumn) {
            if (extSession.dataColumns.indexOf(thisSession.hcColumn) >= 0) {
                scsErrors.push('Unable to rename antibody heavy-chain column due to a clash');
            } else {
                specialColumnSwizzle[extSession.hcColumn] = thisSession.hcColumn;
            }
        }

        if (thisSession.lcColumn && extSession.lcColumn && thisSession.lcColumn !== extSession.lcColumn) {
            if (extSession.dataColumns.indexOf(thisSession.lcColumn) >= 0) {
                scsErrors.push('Unable to rename antibody light-chain column due to a clash');
            } else {
                specialColumnSwizzle[extSession.lcColumn] = thisSession.lcColumn;
            }
        }

        return [specialColumnSwizzle, scsErrors];
    }, [])

    const clashColumns = useMemo(
        () => {
            const leftCols = new Set(thisSession.dataColumns.filter((c) => c !== rJoinLeftKey))
            return extSession.dataColumns.filter((c) => c !== rJoinRightKey && c !== '_gyde_rowid' && leftCols.has(c));
        }, [rJoinLeftKey, rJoinRightKey]
    );

    const typeMismatchColumns = useMemo(
        () => {
            const leftCols = new Set(thisSession.dataColumns);
            return extSession.dataColumns
                .filter((c) => leftCols.has(c))
                .filter((c) => (thisColumnTypes[c] || 'info') !== (extColumnTypes[c] || 'info'));
        }, []
    );

    const nameClashes = useMemo(
        () => {
            const nameSet = new Set(thisSession.columnarData[thisSession.nameColumn] ?? []);
            return (extSession.columnarData[extSession.nameColumn] || []).filter((n) => nameSet.has(n));
        }, []
    );

    const swizzleErrors = useMemo(
        () => {
            const errs = {};
            const usedNames = new Set(thisSession.dataColumns);
            for (const c of extSession.dataColumns) {
                usedNames.add(c);
            }

            for (const c of clashColumns) {
                if (clashActions[c] === 'rename') {
                    const r = nameSwizzle[c] ?? '';
                    if (!r) {
                        errs[c] = 'Must not be empty';
                    } else if (usedNames.has(r)) {
                        errs[c] = 'Duplicate name';
                    } 

                    usedNames.add(r);
                }
            }

            return errs;
        }, [direction, clashColumns, clashActions, nameSwizzle]
    );

    const bound = useMemo(() => {
        let r = extSession;
        const filteredNameSwizzle = {...specialColumnSwizzle};
        for (const [c, n] of Object.entries(nameSwizzle)) {
            if (clashActions[c] === 'rename') filteredNameSwizzle[c] = n;
        }
        if (Object.entries(filteredNameSwizzle).length > 0) {
            r = swizzleColumnNames(r, filteredNameSwizzle);
        }

        if (direction === 'rows') {
            return cbind(thisSession, r, {[thisSession.nameColumn]: nameClashAction});
        } else {
            return rbind(thisSession, r, rJoinLeftKey, rJoinRightKey, rJoinType, clashActions);
        }
    }, [thisSession, extSession, direction, rJoinLeftKey, rJoinRightKey, rJoinType, clashActions, nameSwizzle, nameClashAction,
        specialColumnSwizzle]);

    const mergeIssues = useMemo(() => {
        const mergeIssues = [];

        if (Object.entries(swizzleErrors).length) {
            mergeIssues.push('Issues with column renames');
        }

        if (direction === 'cols') {
            if (clashColumns.some((c) => clashActions[c] === 'fill' && (thisColumnTypes[c] || 'info') !== (extColumnTypes[c] || 'info'))) {
                mergeIssues.push('Attempting to merge columns with type mismatches');
            }

            if (rJoinLeftKeyValid) {
                mergeIssues.push(rJoinLeftKeyValid);
            }
            if (rJoinRightKeyValid) {
                mergeIssues.push(rJoinRightKeyValid);
            }
        }

        if (direction === 'rows') {
            for (const e of scsErrors) mergeIssues.push(e);
        }

        if (incompatibleAntibodyness) {
            mergeIssues.push(incompatibleAntibodyness);
        }

        return mergeIssues;
    }, [incompatibleAntibodyness, clashActions, thisColumnTypes, extColumnTypes, swizzleErrors, scsErrors,
        rJoinLeftKeyValid, rJoinRightKeyValid])

    useEffect(() => {
        resultCallback(bound, mergeIssues);
    }, [bound, mergeIssues]);

    return (
        <Grid container rowSpacing={2}>
            <Grid item xs={2}>
                <div>Join direction:</div>
            </Grid>
            <Grid item xs={10}>
                <ButtonGroup disableElevation variant="contained">
                    <Tooltip title="Add extra columns to your dataset">
                        <Button variant={direction === 'rows' ? 'outlined' : 'contained'} onClick={() => setDirection('cols')}>
                            <AddColumns />
                        </Button>
                    </Tooltip>
                    <Tooltip title="Add extra rows to your dataset">
                        <Button variant={direction === 'cols' ? 'outlined' : 'contained'} onClick={() => setDirection('rows')}>
                            <AddRows />
                        </Button>
                    </Tooltip>
                </ButtonGroup>
            </Grid>

            { incompatibleAntibodyness
              ? <Grid item xs={12}>
                    <div style={{color: 'red'}}>{ incompatibleAntibodyness }</div>
                </Grid>
              : undefined }
            {
                direction === 'cols'
                  ? <React.Fragment>
                        <Grid item xs={2}>
                            <div>Join type:</div>
                        </Grid>
                        <Grid item xs={4}>
                            <ButtonGroup disableElevation variant="contained">
                                <Tooltip title="Full (outer) join: keep non-matching rows from both datasets">
                                    <Button variant={rJoinType === 'full' ? 'contained' : 'outlined'} onClick={() => setRJoinType('full')}>
                                        <JoinFull />
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Inner join: only keep matching rows">
                                    <Button variant={rJoinType === 'inner' ? 'contained' : 'outlined'} onClick={() => setRJoinType('inner')}>
                                        <JoinInner />
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Left join: keep all rows from existing dataset">
                                    <Button variant={rJoinType === 'left' ? 'contained' : 'outlined'} onClick={() => setRJoinType('left')}>
                                        <JoinLeft />
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Right join: keep all rows from new dataset">
                                    <Button variant={rJoinType === 'right' ? 'contained' : 'outlined'} onClick={() => setRJoinType('right')}>
                                        <JoinRight />
                                    </Button>
                                </Tooltip>
                            </ButtonGroup>
                        </Grid>
                        <Grid item xs={3}>
                            <TextField id="bind-select-left-column"
                                       label="Key in this dataset"
                                       value={rJoinLeftKey}
                                       style={{width: '12rem'}}
                                       margin='normal'
                                       error={!!rJoinLeftKeyValid}
                                       helperText={rJoinLeftKeyValid}
                                       select
                                       onChange={(ev) => setRJoinLeftKey(ev.target.value)}>
                                { thisSession.dataColumns.map((k) => (
                                    <MenuItem key={k} value={k}>{k}</MenuItem>
                                )) }
                            </TextField>
                        </Grid>
                        <Grid item xs={3}>
                            <TextField id="bind-select-left-column"
                                       label="Key in merging dataset"
                                       value={rJoinRightKey}
                                       style={{width: '12rem'}}
                                       margin='normal'
                                       error={!!rJoinRightKeyValid}
                                       helperText={rJoinRightKeyValid}
                                       select
                                       onChange={(ev) => setRJoinRightKey(ev.target.value)}>
                                { extSession.dataColumns.map((k) => (
                                    <MenuItem key={k} value={k}>{k}</MenuItem>
                                )) }
                            </TextField>
                        </Grid>
                        { clashColumns?.length > 0
                          ?  <Grid item xs={12}>
                                <h4>Warning: some column names clash between datasets</h4>

                                <Paper
                                    elevation={6}
                                    sx={{padding: '1rem'}}
                                >
                                    <Grid container  columnSpacing={2} sx={{maxHeight: 400, overflowY: 'scroll'}}>
                                        { clashColumns.map((c) => {
                                            const thisType = thisColumnTypes[c] || 'info',
                                                  extType = extColumnTypes[c] || 'info';

                                            return (
                                                <React.Fragment key={c}>
                                                    <Grid item xs={3} style={{display: 'flex', flexDirection: 'column', paddingTop: '0.5rem'}}>
                                                        <div>{c}</div>
                                                    </Grid>
                                                    <Grid item xs={3}>
                                                        <Select id="type"
                                                                size="small"
                                                                value={ clashActions[c] || 'ignore' }
                                                                fullWidth
                                                                onChange={ev => updateClashAction({column: c, action: ev.target.value})}>
                                                             <MenuItem value="ignore">Ignore</MenuItem>
                                                             <MenuItem value="rename">Rename</MenuItem>
                                                             <MenuItem value="fill">Fill gaps</MenuItem>
                                                        </Select>
                                                    </Grid>
                                                    <Grid item xs={6} style={{display: 'flex', flexDirection: 'column'}}>
                                                        { clashActions[c] === 'rename'
                                                          ? <div style={{display: "flex", flexDirection: "row", alignItems: 'center'}}>
                                                                <div style={{paddingRight: '1rem'}}>
                                                                    -->
                                                                </div>
                                                                <TextField id="refseq"
                                                                           variant="outlined"
                                                                           size="small"
                                                                           value={nameSwizzle[c] || ''}
                                                                           error={!!swizzleErrors[c]}
                                                                           helperText={swizzleErrors[c]}
                                                                           onChange ={(ev) => updateNameSwizzle({column: c, name: ev.target.value})}/>
                                                            </div>
                                                          : undefined }
                                                        { (thisType !== extType && clashActions[c] === 'fill')
                                                          ? <div style={{color: 'red', paddingTop: '0.75rem'}}>Column types do not match: {thisType} !== {extType}</div>
                                                          : undefined }

                                                    </Grid>
                                                </React.Fragment>
                                            );
                                        }) }
                                    </Grid>
                                </Paper>
                             </Grid>
                          : undefined }
                    </React.Fragment>
                  : <React.Fragment>
                        { nameClashes?.length > 0
                          ? <React.Fragment>
                                <Grid item xs={6}>
                                    Warning: duplicate names exist.
                                </Grid>
                                <Grid item xs={6}>
                                    <Select id="type"
                                            size="small"
                                            value={ nameClashAction }
                                            fullWidth
                                            onChange={ev => setNameClashAction(ev.target.value)}>
                                         <MenuItem value="discard">Discard items with duplicate names</MenuItem>
                                         <MenuItem value="disambiguate">Append a suffix (e.g. "_2") to duplicate names</MenuItem>
                                    </Select>
                                </Grid>
                            </React.Fragment>
                          : undefined }

                        { typeMismatchColumns?.length > 0
                          ? <Grid item xs={12}>
                                <h4>Warning: some column types do not match</h4>

                                <Paper
                                    elevation={6}
                                    sx={{padding: '1rem'}}
                                >
                                    <Grid container  columnSpacing={2} sx={{maxHeight: 400, overflowY: 'scroll'}}>
                                        { typeMismatchColumns.map((c) => {
                                            const thisType = thisColumnTypes[c] || 'info',
                                                  extType = extColumnTypes[c] || 'info';

                                            return (
                                                <React.Fragment key={c}>
                                                    <Grid item xs={3} style={{display: 'flex', flexDirection: 'column', paddingTop: '0.5rem'}}>
                                                        <div>{c}</div>
                                                    </Grid>
                                                    <Grid item xs={3}>
                                                        <Select id="type"
                                                                size="small"
                                                                value={ clashActions[c] || 'ignore' }
                                                                fullWidth
                                                                onChange={ev => updateClashAction({column: c, action: ev.target.value})}>
                                                             <MenuItem value="ignore">Ignore</MenuItem>
                                                             <MenuItem value="rename">Rename</MenuItem>
                                                        </Select>
                                                    </Grid>
                                                    <Grid item xs={6} style={{display: 'flex', flexDirection: 'column'}}>
                                                        { clashActions[c] === 'rename'
                                                          ? <div style={{display: "flex", flexDirection: "row", alignItems: 'center'}}>
                                                                <div style={{paddingRight: '1rem'}}>
                                                                    -->
                                                                </div>
                                                                <TextField id="refseq"
                                                                           variant="outlined"
                                                                           size="small"
                                                                           value={nameSwizzle[c] || ''}
                                                                           error={!!swizzleErrors[c]}
                                                                           helperText={swizzleErrors[c]}
                                                                           onChange ={(ev) => updateNameSwizzle({column: c, name: ev.target.value})}/>
                                                            </div>
                                                          : undefined }

                                                    </Grid>
                                                </React.Fragment>
                                            );
                                        }) }
                                    </Grid>
                                </Paper>
                            </Grid>
                        : undefined }
                    </React.Fragment>
            }

            <Grid item xs={12}>
                { bound 
                    ? <DatasetPreview {...bound} />
                    : undefined }
            </Grid>

        </Grid>
    )
}   
