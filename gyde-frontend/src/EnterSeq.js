import React, {useReducer, useCallback} from 'react'

import { TextField, Button, ButtonGroup, Grid, FormControlLabel, FormControl, InputLabel, MenuItem, Select, Checkbox } from '@mui/material';
import {createTheme, ThemeProvider, styled} from '@mui/material/styles';

import {SmilesParser} from 'openchemlib/minimal';

import {usePinger} from './Pinger';

const theme = createTheme({
    palette: {
        mode: 'dark'
    }
})

function reshape(oldState, rows, cols) {
    let {entryNames, columnNames, sequences, columnTypes, ...otherProps} = oldState;

    const oldRows = entryNames.length,
          oldCols = columnNames.length;

    if (cols < oldCols) {
        columnNames = [...columnNames];
        columnNames.splice(cols);

        columnTypes = [...columnTypes];
        columnTypes.splice(cols)

        sequences = sequences.map((row) => {
            const newRow = [...row];
            newRow.splice(cols);
            return newRow;
        });
    } else if (cols > oldCols) {
        columnNames = [...columnNames];
        for (let j = oldCols; j < cols; ++j) columnNames.push(`Chain ${j+1}`);

        columnTypes = [...columnTypes]
        for (let j = oldCols; j < cols; ++j) columnTypes.push('protein');

        sequences = sequences.map((row) => {
            const newRow = [...row];
            for (let j = oldCols; j < cols; ++j) newRow.push('');
            return newRow;
        });
    }

    if (rows < oldRows) {
        entryNames = [...entryNames]
        entryNames.splice(rows);

        sequences = [...sequences];
        sequences.splice(rows);
    } else if (rows > oldRows) {
        entryNames = [...entryNames];
        sequences = [...sequences];
        for (let i = oldRows; i < rows; ++i) {
            entryNames.push(`Protein ${i+1}`);
            const newSeqRow = [];
            for (let j = 0; j < cols; ++j) {
                newSeqRow.push('');
            }
            sequences.push(newSeqRow);
        }
    }

    return {
        entryNames, columnNames, sequences, columnTypes,
        ...otherProps
    };
}

function reduceState(oldState, {action, ...props}) {
    if (action === 'sequence') {
        const {row, col, sequence} = props;
        const newSeqs = [...oldState.sequences];
        newSeqs[row] = [...newSeqs[row]];
        if (oldState.columnTypes[col] === 'protein') {
            newSeqs[row][col] = (sequence || '').replace(/\s+/g, '').toUpperCase();
        } else {
            newSeqs[row][col] = (sequence || '');
        }
        return {
            ...oldState,
            sequences: newSeqs
        };
    } else if (action === 'colName') {
        const {col, name} = props;
        const newNames = [...oldState.columnNames];
        newNames[col] = name;
        return {...oldState, columnNames: newNames};
    } else if (action == 'colType') {
        const {col, type} = props;
        const newTypes = [...oldState.columnTypes];
        newTypes[col] = oldState.type === 'anarciSeqs' ? 'protein' : type;
        return {...oldState, columnTypes: newTypes};
    } else if (action === 'entName') {
        const {row, name} = props;
        const newNames = [...oldState.entryNames];
        newNames[row] = name;
        return {...oldState, entryNames: newNames};
    } else if (action === 'reshape') {
        return reshape(oldState, props.rows ?? oldState.entryNames.length, props.cols ?? oldState.columnNames.length);
    } else if (action === 'type') {
        let newState;
        if (props.type === 'anarciSeqs') {
            newState = reshape(oldState, oldState.entryNames.length, 2);
            newState.columnNames = ['Heavy chain', 'Light chain'];
            newState.columnTypes = ['protein', 'protein'];
        } else {
            newState = {...oldState};
            newState.columnNames = [];
            for (let i = 0; i < oldState.columnNames.length; ++i) newState.columnNames[i] = `Chain ${i + 1}`;
        }
        newState.seqType = props.type;
        return newState;
    } else {
        return oldState;
    }
}

export default function EnterSeq({
    onDataLoad
}) {

    const [
        {columnNames, entryNames, sequences, columnTypes, seqType},
        updateState
    ] = useReducer(
        reduceState,
        {
            columnNames: ['Chain 1'],
            entryNames: ['Protein 1'],
            sequences: [['']],
            columnTypes: ['protein'],
            seqType: 'alignedSeqs'
        }
    );
    const isAntibody = seqType === 'anarciSeqs';

    const rows = entryNames.length,
          cols = columnNames.length;

    const pinger = usePinger();

    const onSubmit = useCallback((ev) => {
        const rows = entryNames.length,
              cols = columnNames.length;

        const columnarData = {
            concept_name: [...entryNames],
            seqid: entryNames.map((_, i) => `seq${i}`)
        };

        const seqColumns = [],
              seqColumnNames = [],
              gydeColumnTypes = {},
              columnDisplayNames = {},
              msaDataFields = ['Names'];

        columnNames.forEach((colLabel, columnIndex) => {
            const colType = columnTypes[columnIndex],
                  colKey = colType === 'protein' ? 'sequence' : colType === 'smiles' ? 'ligand' : 'column';
            const colName = `${colKey}_${columnIndex+1}`;
            columnarData[colName] = entryNames.map((_, i) => sequences[i][columnIndex] || '');

            if (colType === 'protein' || colType === 'dna' || colType === 'rna') {
                seqColumns.push({
                    column: colName
                });
                seqColumnNames.push(colLabel);

                gydeColumnTypes[colName] = colType;
            } else {
                msaDataFields.push(colName);
                columnDisplayNames[colName] = colLabel;
                if (colType === 'smiles') {
                    gydeColumnTypes[colName] = 'smiles';
                } 
            }
        });

        pinger('dataset.enterseq');

        onDataLoad(undefined, {
            name: 'User proteins',
            columnarData,
            dataColumns: Object.keys(columnarData),
            seqColumns,
            seqColumnNames,
            alignmentKey: seqType,
            isAntibody,
            hcColumn: isAntibody ? 'sequence_1' : undefined,
            lcColumn: isAntibody ? 'sequence_2' : undefined,
            columnTypes: gydeColumnTypes,
            msaDataFields,
            nameColumn: 'concept_name',
            columnDisplayNames
        });

    }, [columnNames, columnTypes, entryNames, sequences, isAntibody, onDataLoad]);

    const SEQ_VALID = /^[ACDEFGHIKLMNPQRSTVWY]*$/,
          DNA_VALID = /^[ACGT]*$/,
          RNA_VALID = /^[ACGU]*$/;
    const smiles = new SmilesParser();
    const smilesCheck = (s) => {
        try {
            smiles.parseMolecule(s);
            return true;
        } catch (ex) {
            return false;
        }
    };

    const validate = (type, val) => {
        if (!val || val.length === 0) {
            return 'A value is required';
        } else if (type === 'smiles') {
            return !smilesCheck(val);
        } else if (type === 'protein') {
            return !(SEQ_VALID.exec(val));
        } else if (type === 'dna') {
            return !(DNA_VALID.exec(val));
        } else if (type === 'rna') {
            return !(RNA_VALID.exec(val));
        }
    }

    const errors = entryNames.some((n) => !n) ||
        columnNames.some((n) => !n) ||
        sequences.some((row) => row.some((seq, i) => validate(columnTypes[i], seq)));

    return (
        <ThemeProvider theme={theme}>
        <Grid container 
              spacing={1}
              style={{maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto', marginBottom: '2rem'}}>
            <Grid item xs={12}>
                <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
                    <h2>Enter sequences to create a new dataset</h2>
                    <ul>
                        <li>
                            If you have several sequences which form a complex
                            (e.g. for running tools such as Alphafold), place them in 
                            multiple columns of the same row)
                        </li>
                        <li>
                            If you have several sequences you wish to compare, place
                            them on separate rows.
                        </li>
                    </ul>
                </div>
            </Grid>
            <Grid item xs={4}>
                <FormControl>
                    <InputLabel id="dstype-label">Dataset type:</InputLabel>
                    <Select labelId="dstype-label"
                            id="dstype"
                            value={seqType}
                            label="Dataset type"
                            onChange={(ev) => updateState({action: 'type', type: ev.target.value})}>
                        <MenuItem value="alignedSeqs">Protein (Align with MAFFT)</MenuItem>
                        <MenuItem value="anarciSeqs">Antibody (Align by Kabat numbering)</MenuItem>
                        <MenuItem value="seqs">N/A (Do not align)</MenuItem>
                        { undefined && <MenuItem value="pre">Pre-aligned</MenuItem>  /* TBD */}
                    </Select>
                </FormControl>
            </Grid>
            <Grid item xs={2}>
                Chains: {cols}&nbsp;
                <ButtonGroup variant="contained">
                    <Button color="primary" 
                            disabled={isAntibody || (cols <= 1)}
                            onClick={(_) => updateState({action: 'reshape', cols: cols-1})}>
                        -
                    </Button> 
                    <Button color="primary" 
                            disabled={isAntibody}
                            onClick={(_) => updateState({action: 'reshape', cols: cols+1})}>
                        +
                    </Button> 
                </ButtonGroup>
            </Grid>
            <Grid item xs={2}>
                {cols > 1 ? "Complexes" : "Proteins"}: {rows}&nbsp;
                <ButtonGroup variant="contained">
                    <Button color="primary" 
                            disabled={rows <= 1}
                            onClick={(_) => updateState({action: 'reshape', rows: rows-1})}>
                        -
                    </Button>
                    <Button color="primary" 
                            disabled={false}
                            onClick={(_) => updateState({action: 'reshape', rows: rows+1})}>
                        +
                    </Button> 
                </ButtonGroup>
            </Grid>
        </Grid>
        <Grid container 
              spacing={1}
              columns={2*cols+1}
              justifyContent="center"
              style={{maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto', marginBottom: '2rem', alignItems: 'center'}}>

            
            <Grid item xs={1}>
                { /* dummy */}
            </Grid>
            { columnNames.map((cn, i) => (
                <Grid item key={i} xs={2}>
                    <TextField value={cn}
                               variant="standard"
                               placeholder="A column name is required"
                               fullWidth
                               error={!cn}                               
                               onChange={(ev) => updateState({action: 'colName', col: i, name: ev.target.value})} />
                    <FormControl size="small" sx={{width: '100%'}}>
                        <Select value={columnTypes[i]}
                                disabled={isAntibody}
                                onChange={(ev) => updateState({action: 'colType', col: i, type: ev.target.value})}>
                            <MenuItem value="protein">Protein</MenuItem>
                            <MenuItem value="dna">DNA</MenuItem>
                            <MenuItem value="rna">RNA</MenuItem>
                            <MenuItem value="smiles">Ligand (SMILES)</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            )) }
            { entryNames.map((en, j) => (
                <React.Fragment key={j}>
                    <Grid item xs={1}>
                        <TextField value={en} 
                                   variant="standard"
                                   placeholder="An entry name is required"
                                   fullWidth
                                   error={!en}
                                   onChange={(ev) => updateState({action: 'entName', row: j, name: ev.target.value})} />
                    </Grid>
                    { sequences[j].map((seq, i) => {
                        const colType = columnTypes[i];
                        const invalid = validate(colType, seq);

                        return (
                            <Grid item xs={2} key={i}>
                                <TextField value={seq}
                                           placeholder={`A ${colType === 'protein' ? 'sequence' : 'value'} is required`}
                                           fullWidth
                                           error={!seq || invalid}
                                           helperText={invalid ? (colType === 'smiles' ? 'Invalid SMILES string' : 'Invalid characters present') : undefined}
                                           onChange={(ev) => updateState({action: 'sequence', row: j, col: i, sequence: ev.target.value})} />
                            </Grid>
                        );
                    })}
                </React.Fragment>
            )) }
        </Grid>
        <Grid container 
              spacing={1}
              style={{maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto', marginBottom: '2rem', justifyItems: 'center'}}>
            <Grid item xs={12}>
                <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column'}}>
                    <Button variant="contained" 
                            color="primary" 
                            size="large"
                            disabled={errors}
                            onClick={onSubmit}>
                        Create dataset
                    </Button> 
                </div>
            </Grid>
        </Grid>
        </ThemeProvider>
    );
}