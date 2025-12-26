import React, {useState} from 'react';

import {Button, TextField, MenuItem, LinearProgress, Dialog, Stack, DialogTitle,
    DialogActions, DialogContent, IconButton, Table, TableContainer, TableRow, TableCell, 
    TableHead, TableBody, Divider, Input, Switch
} from '@mui/material';
import {Close} from "@mui/icons-material"

import {readAsText} from '../utils/loaders';
import {rapidStabilityPrediction} from './analysis';
import { getPdbChains, renumberPdb } from '../utils/pdb';
import { aosToSoa } from '../utils/utils';
import { usePinger } from '../Pinger';
import { parseStructureData } from '../structureView/utils';

import { useSlivka } from '../czekolada/lib';

import { saveAs } from 'file-saver';


export const RaSPDialog = (props) => {
    const {open, onClose, passedProps} = props;
    const {structureKeys, columnarData, soloSelection, onDataLoad} = passedProps;

    const [structureRaw, setStructureRaw] = useState(null);
    const [structureDataBlob, setStructureDataBlob] = useState(null);
    const [dataErr, setDataErr] = useState(null);
    const [jobName, setJobName] = useState('');
    const [analysisRunning, setAnalysisRunning] = useState(null);
	const [analysisError, setAnalysisError] = useState(null);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [chainData, setChainData] = useState(null);
    const [chain, setChain] = useState('');
    
    const availStructureKeys = structureKeys.filter((k) => !!columnarData[k] && !!columnarData[k][soloSelection]);
    const [structureKey, setStructureKey] = useState(null);

    const nameColumn = 'concept_name';

    const reset = () => {
        setStructureDataBlob(null);
        setDataErr(null);
        setJobName('')
        setAnalysisError(null);
        setAnalysisStatus(null)
        setChainData(null);
        setChain('');
        setStructureKey(null);
    }

    const onHide = () => {
        onClose();
        reset();
    }

    const ss = useSlivka();
    const submitJob = async (pdbBlob, mapping) => await rapidStabilityPrediction(
        ss, pdbBlob, jobName || '', chain, chainData, mapping, nameColumn,
        {
            statusCallback: ({status}) => {console.log('status', status); setAnalysisStatus(status)
        }
    });

    const loadRaSPData = (results, structureBlob) => {
        const scores = results.map(r => r.score_ml_fermi);
        scores.sort((a, b) => a-b);

        let thresholded = results;

        if (!useAllResults) {
            const scoreThreshold = scores.length >= numResults ? scores[numResults - 1] : scores[scores.length-1];
            thresholded = results.filter((r) => r.score_ml_fermi <= scoreThreshold);
        }

        const gydeData = aosToSoa(thresholded);
        gydeData.structure_url = gydeData.structure_url.map(() => structureBlob)
        gydeData.seqid = gydeData[nameColumn];
        gydeData.structure_chains = thresholded.map((_) => [results.chain]);
        gydeData.structure_residue_numbering = thresholded.map((_) => [results.residueNumbers]);

        onDataLoad(undefined, {
            columnarData: gydeData,
            dataColumns: results.columns,
            dataRowCount: thresholded.length,
            alignmentKey: 'seqs',
            seqColumns: [{column: 'HC_sequence', numbering: results.residueNumbers.map((r) => r?.value?.residueNumber || '')}],
            seqColumnNames: ['Chain ' + results.chain],
            seqRefColumns: [{column: 'HC_sequence_base'}],
            isAntibody: false,
            isHeatmapVisible: true,
            heatmapSelectedColumn: 'score_ml_fermi',
            msaDataFields: ['Names', 'score_ml_fermi'],
            nameColumn,
            name: `RaSP: ${jobName ? (jobName+'_'+chain) : ''}`
        });
    }

    const selectStructure = async (key) => {
        try {
            const structureData = columnarData[key][soloSelection];

            if (!structureData) return;
            const {structureText, format}  = await parseStructureData(structureData);
            if (format !== 'pdb') {
                throw Error('Only support PDB inputs for now');
            }

            setStructureKey(key);
        
            const chains = await getPdbChains(structureText);

            setChainData(chains);
        	setStructureDataBlob(new Blob([structureText], {type: 'chemical/x-pdb'}));
            setStructureRaw(structureData);
        	setDataErr(null);
        } catch (err) {
        	setStructureDataBlob(null);
        	setDataErr(err.message || err);
        }
	}

    const pinger = usePinger();

    const [numResults, setNumResults] = useState(100);
    const [useAllResults, setUseAllResults] = useState(true);

    const runRasp = async () => {
		try {
            pinger('analysis.rasp');
            
            setAnalysisRunning(true);
            setAnalysisError(undefined);

            const data = await readAsText(structureDataBlob);
            const {renumberedData, mapping} = renumberPdb(data, chain);
            const renumberedPdbBlob = new Blob([renumberedData], {type: 'chemical/x-pdb'});
            
			const results = await submitJob(renumberedPdbBlob, mapping)
            loadRaSPData(results, structureRaw);  // Use "raw" structure here to avoid losing metadata.
		} catch (err) {
            console.log(err.message ?? err);

            setAnalysisError(err.message || err);
            setAnalysisRunning(false);
            throw err;
		} finally {
            setAnalysisRunning(false);
        }
	}

    let chainList;
    if (chainData) chainList = Object.keys(chainData);

    return (
        <Dialog
            open={open}
            onClose={onHide}
        >
            <DialogTitle>
                Run RaSP
                <IconButton
                    aria-label="close"
                    onClick={onHide}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                    }}
                >
                    <Close/>
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    width: '40vw',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '25px',
                }}
            >
                <TextField
                    id="rasp-structure-select"
                    label="Select structure"
                    value={structureKey ? structureKey : ''}
                    style={{width: '12rem'}}
                    margin='normal'
                    select
                    onChange={(ev) => selectStructure(ev.target.value)}
                >
                    { availStructureKeys.map((k) => (
                        <MenuItem key={k} value={k}>{k}</MenuItem>
                    )) }
                </TextField>

                {(!!structureDataBlob && chainList.length > 0)
                ?
                <React.Fragment>
                    <Divider/>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Chain</TableCell>
                                    <TableCell>Sequence</TableCell>
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {chainList && chainList.map((chain) => (
                                    <TableRow key={chain}>
                                        <TableCell>{chain}</TableCell>
                                        <TableCell>{chainData[chain]['rawAtomicSequence']}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Stack direction='row' gap='10px'>
                        <TextField
                            id="round-select"
                            label="Chain to analyse"
                            value={ chain || ''}
                            style={{width: '8rem'}}
                            select
                            error={chainData && !chain}
                            helperText={(chain || !chainData) ? undefined : 'Select a chain'}
                            onChange={(ev) => setChain(ev.target.value)}
                        >
                            { (chainList || []).map(chain => (
                                <MenuItem key={ chain } value={ chain }>{ chain }</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Job name"
                            fullWidth
                            type='text'
                            value={jobName}
                            onKeyDown={(ev) => ev.stopPropagation()}
                            onChange={(ev) => setJobName(ev.target.value)}
                        />
                    </Stack>
                    <Stack direction='row' gap='10px' alignItems={'center'}>
                        <div 
                            style={{userSelect: 'none', opacity: useAllResults? '100%' : '30%'}}
                        >
                            All results
                        </div>
                        <Switch
                            checked={!useAllResults}
                            onChange={() => setUseAllResults(!useAllResults)}/>
                        <div 
                            style={{userSelect: 'none', opacity: useAllResults? '30%' : '100%'}} 
                        >
                            top
                        </div>
                        <Input
                            value={numResults}
                            onChange={(ev) => setNumResults(ev.target.value)}
                            inputProps={{
                                step: 1,
                                min: 0,
                                max: 10000,
                                type: 'number',
                            }}
                            style={{maxWidth: '4rem', opacity: useAllResults? '30%' : '100%'}}
                        />
                    </Stack>
                </React.Fragment>
                : null
                }
                { dataErr ? 
                    <div style={{color: 'red'}}>
                        { dataErr }
                    </div>
                    : null
                }
                { analysisError ?
                    <div style={{color: 'red'}}>
                        { analysisError }
                    </div>
                    : null
                }
                { analysisRunning ?
                    <div>
                        <div style={{
                            textAlign: 'center',
                            paddingBottom: '4px',
                            fontWeight: '700',
                            color: '#777777'
                        }}>
                            { analysisStatus }
                        </div>
                        <LinearProgress />
                    </div>
                    : null 
                }
            </DialogContent>

            <DialogActions>
                <Button
                    variant={'contained'}
                    onClick={runRasp}
                    disabled={!structureDataBlob || !chain || analysisRunning}
                >
                    Run
                </Button>
                <Button onClick={onHide}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default RaSPDialog;
