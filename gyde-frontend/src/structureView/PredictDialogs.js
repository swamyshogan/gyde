import React, {useMemo, useState, useReducer, useCallback, useEffect, createContext, useContext} from 'react';
import {CircularProgress, Checkbox, FormControlLabel, Typography, Stack, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField} from '@mui/material';

import { useSlivka, configMapToFormData, ServiceLauncher } from '../czekolada/lib';


const PredictionOptionsContext = createContext(() => [{}, () => {}]);
const usePredictionOptions = () => useContext(PredictionOptionsContext);

export {PredictionOptionsContext, usePredictionOptions};

export function StructurePredictDialog({
    method,
    methodKey,
    jobName: managedJobName,
    inputConstructor,
    structureInfos,
    onJobSubmitted,
    onHide,
    listener,
    hideParams: managedHideParams=undefined,
    constrainParams=[],
    message,
    onJobReady,
    constrainOptions={},
    skipValidationParams=[],

    structureSuffixes,
    dataColumns,
    structureKeys,
    columnTypes,
    columnarData
}) {
    const [jobParameters, setJobParameters] = useState();
    const [jobName, setJobName] = useState();
    const [error, setError] = useState();
    const slivkaService = useSlivka();


    const {structureColumnSet, otherColumnSet} = useMemo(() => {
        const structureColumnSet = new Set(structureKeys);
        const otherColumnSet = new Set(dataColumns.filter((c) => !(structureColumnSet.has(c))));

        return {structureColumnSet, otherColumnSet};
    }, [dataColumns, structureKeys, columnTypes]);

    const {clashStructure, clashOther, clashHelperText} = useMemo(() => {
        let clashStructure = false, clashOther = false;
        for (const ss of structureSuffixes || ['']) {
            const colName = jobName + ss;
            if (structureColumnSet.has(colName) && structureInfos) {
                const data = columnarData[colName] || [];
                for (const si of structureInfos) {
                    for (const di of si.dataIndices || []) {
                        const d = data[di];
                        if (d && d?._gyde_analysis !== 'error') {
                            clashStructure = true;
                        }
                    }
                }
            }
            if (otherColumnSet.has(colName)) clashOther = true;
        }

        let clashHelperText = null;
        if (clashOther) {
            clashHelperText = 'Column name already in use, chose another';
        } else if (clashStructure) {
            clashHelperText = 'A structure with this name already exists.  Overwrite?'
        }

        return {clashStructure, clashOther, clashHelperText};
    }, [structureColumnSet, otherColumnSet, jobName, structureSuffixes, structureInfos, columnarData]);

    managedJobName ||= methodKey;

    useEffect(() => {
        setJobName(managedJobName);
    }, [managedJobName]);

    const predictionOptionsBaton = useReducer(
        (options, update) => {
            if (typeof(update) === 'function') {
                const updateResult = update(options);
                if (updateResult === null) return options;
                return {...options, ...updateResult};
            } else {
                return {...options, ...update};
            }
        },
        {}
    );
    const [predictionOptions, updatePredictionOptions] = predictionOptionsBaton;

    const parameterCallback = useCallback((params, validationErrors) => {
        if (params && (!validationErrors || Object.keys(validationErrors).length === 0)) {
            setJobParameters(params);
        } else {
            setJobParameters(undefined);
        }
    }, [setJobParameters]);

    const boundParams = useMemo(() => {
        try {
            const bp = structureInfos && structureInfos.length > 0 ? inputConstructor(structureInfos[0]) : {};
            setError(undefined);
            return bp;
        } catch (err) {
            setError(err.message || err);
        }
    }, [structureInfos]);

    const hideParams = useMemo(() => managedHideParams || Object.keys(boundParams || {}), [managedHideParams, boundParams]);

    const runPredictions = useCallback(() => {
        const service = slivkaService.services.find((s) => s.id === method);

        structureInfos.forEach((structureInfo) => {
            if (onJobReady) {
                onJobReady(structureInfo, jobParameters, inputConstructor, predictionOptions, jobName);
            } else {
                const structureParams = inputConstructor(structureInfo, predictionOptions);
                const params = {...jobParameters, ...structureParams};
                let firstPing = true;
                const augListener = ((status) => {
                    onJobSubmitted({...status, structureInfo: structureInfo, firstPing, jobName});
                    firstPing = false;
                });

                slivkaService.submit(
                    method,
                    configMapToFormData(service, params),
                    {useCache: true},
                    augListener
                );
            }
        });
    }, [structureInfos, jobParameters, onJobSubmitted, onJobReady, inputConstructor, predictionOptions, jobName]);

    const textfieldCallback = useCallback((field) => {
        if (field) {
            const input = field.querySelector('input');
            if (input) {
                input.focus()
            }
        }
    }, []);

    if (!structureInfos) return undefined;

    return (
        <PredictionOptionsContext.Provider value={predictionOptionsBaton}>
            <Dialog open={true}
                    onClose={onHide}
                    maxWidth="80vw">
                <DialogTitle id="upload-structure-dialog-title">
                    Run {method}
                </DialogTitle>
                <DialogContent
                    sx={{
                        width: '40rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '40px',
                    }}
                >
                    {error
                        ? <div style={{color: 'red'}}>{ error.toString() }</div>
                        : <React.Fragment>
                            {message 
                                ? <div>{ message}</div>
                                : undefined }
                            <TextField
                                ref={textfieldCallback}
                                label="Job name"
                                error={clashOther || !jobName}
                                helperText={jobName ? clashHelperText : 'A job name is required'}
                                color={(clashStructure && !clashOther) ? 'warning' : undefined}
                                fullWidth
                                type="text"
                                value={jobName}
                                sx={{marginTop: '0.5rem'}}
                                onChange={(ev) => setJobName(ev.target.value)} />

                            <ServiceLauncher service={method}
                                             baseParams={boundParams}
                                             hideParams={hideParams}
                                             constrainParams={constrainParams}
                                             constrainOptions={constrainOptions}
                                             showSubmitButton={false}
                                             skipValidationParams={skipValidationParams}
                                             parameterCallback={parameterCallback} />
                          </React.Fragment> }
                </DialogContent>
                <DialogActions>
                    <Button onClick={runPredictions}
                            disabled={!jobParameters || error || clashOther || !jobName}>
                        Predict structures
                    </Button>
                </DialogActions>
            </Dialog>
        </PredictionOptionsContext.Provider>
    );
}


export function NimPredictionDialog({
    method,
    input,
    structureInfos,
    onJobReady,
    onHide
}) {
    const [token, setToken] = useState('');

    const runPredictions = useCallback(() => {
        structureInfos.forEach((structureInfo) => {
            onJobReady(structureInfo, token);
        });
    }, [structureInfos, onJobReady, token]);

    const textfieldCallback = useCallback((field) => {
        if (field) {
            const input = field.querySelector('input');
            if (input) {
                input.focus()
            }
        }
    }, []);

    if (!method || !structureInfos) {
        return undefined
    }

    return (
        <Dialog open={!!method}
                onClose={onHide}
                maxWidth="80vw">
            <DialogContent
                sx={{
                    width: '40rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '40px',
                }}
            >
                <TextField
                    ref={textfieldCallback}
                    label="Nvidia Nim API key"
                    error={!token}
                    helperText={token ? undefined : 'A NIM API token is required'}
                    fullWidth
                    type="password"
                    value={token}
                    sx={{marginTop: '0.5rem'}}
                    onChange={(ev) => setToken(ev.target.value)} />
            </DialogContent>
            <DialogActions >
                <Button onClick={runPredictions}
                        disabled={!token || !token.length}>
                    Predict structures
                </Button>
            </DialogActions>
        </Dialog>
    )
}
