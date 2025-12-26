import React, {useState, useCallback, useEffect, useLayoutEffect, useMemo, useReducer} from 'react';
import {Grid, Button, TextField, MenuItem, Accordion, AccordionSummary, AccordionDetails,
    Checkbox, FormControlLabel, FormControl, InputLabel, Select, Paper, VisuallyHiddenInput} from '@mui/material';
import {ExpandMore as ExpandMoreIcon, Article as ArticleIcon, 
        ContentPasteGo as PasteIcon, Upload as UploadIcon} from '@mui/icons-material';
import {createTheme, ThemeProvider} from '@mui/material/styles';

import {parse as parseSDF} from 'sdf-parser';

import {loadSpreadsheet, convertToJson, readAsArrayBuffer, readAsText} from './utils/loaders';
import {getPdbChains} from './utils/pdb.js';
import {aosToSoaInclusive} from './utils/utils.js';
import {usePinger} from './Pinger';

import DatasetPreview from './DatasetPreview';
import BindConfig from './BindConfig';

import {fastaParse} from './utils/utils';

const theme = createTheme({
    palette: {
        mode: 'dark',
        background: '#153452'
    }
});

// Default menu styling involves fractional-alpha and looks awful with our colour scheme.
// So let's do hover and selected effects "manually" for now.
const menuItemStyle = {
    backgroundColor: '#153452',
    '&:hover': {backgroundColor: '#457482'},
    '&.Mui-selected': {
        backgroundColor: '#254462',
        opacity: 1.0,
        '&:hover': {backgroundColor: '#457482'}
    },
    '&.Mui-disabled': {
        backgroundColor: '#254462',
        opacity: 1.0
    }
};

function substitute(seq, index, mutation) {
    return seq.split('').map((r, i) => i === (index-1) ? mutation : r).join('');
}

function extractFromURLList(index, ulstr) {
    const urlList = JSON.parse(ulstr.replace(/'/g, '"'));
    return urlFix(urlList[index]);
}

function urlFix(url) {
    url = url ? ('' + url) : '';
    if (url?.startsWith('../')) {
        return '/data/' + url.substring(3);
    }
    return url;
}

export async function tableFromClipboard() {
    const readResult = await navigator.clipboard.read();
    if (readResult.length === 0) {
        throw Error('Nothing pasted');
    }

    if (readResult[0].types.indexOf('text/html') < 0) {
        throw Error('Pasted data cannot be interpreted as a table/spreadsheet');
    }

    const blob = await readResult[0].getType('text/html');
    const text = await blob.text();

    const tree = new DOMParser().parseFromString(text, "text/html");

    const table = tree.querySelector('table');
    if (!table) {
        throw Error('Pasted data does contain a table');
    }

    const data = Array.from(table.querySelectorAll('tr')).map((row) => 
        Array.from(row.querySelectorAll('td, th')).map((cell) => 
            cell.textContent
        )
    )

    return data;
}

export default function Upload({onDataLoad, loadedSessions=[]}) {
    const [data, setData] = useState();
    const [dataErr, setDataErr] = useState();
    const [dataMsg, setDataMsg] = useState('Upload data to proceed');
    const [mode, setMode] = useState();

    const selectDataFile = useCallback(async (ev) => {
        setMode(undefined);
        const file = ev.target.files[0];
        if (! (file instanceof Blob)) {
            setDataMsg(undefined);
            return;
        }

        let fileName = file.name;
        if (fileName) {
            const dotIndex = fileName.lastIndexOf('.');
            if (dotIndex > 0) {
                fileName = fileName.substring(0, dotIndex);
            }
        }

        if (file.name && file.name.endsWith('.sdf')) {
            try {
                const structData = await readAsText(file);

                const {molecules: sdfMolecules, labels: sdfColumns} = parseSDF(structData);
                const properties = sdfMolecules.map((mol) => {
                    const props = {...mol};
                    props.concept_name = mol.molfile.split('\n')[0]; 
                    delete props['molfile'];
                    return props
                });
                properties.columns = sdfColumns;

                setData({
                    structure: new Blob([structData], {type: 'chemical/x-mdl-molfile'}),
                    sdfProperties: properties,
                    name: fileName
                });
                setDataMsg(undefined)
                setDataErr(undefined)
                setMode('sdf')
            } catch (err) {
                setData(undefined);
                setDataMsg(undefined);
                setDataErr(err.message || err);
                setMode(undefined);
            }
        } else if (file.name && file.name.endsWith('.pdb')) {
            try {
                const structData = await readAsText(file);
                const chains = await getPdbChains(structData);

                setData({
                    chains,
                    structure: new Blob([structData], {type: 'chemical/x-pdb'}),
                    name: fileName
                });
                setDataMsg(undefined)
                setDataErr(undefined)
                setMode('structure')
            } catch (err) {
                setData(undefined);
                setDataMsg(undefined);
                setDataErr(err.message || err);
                setMode(undefined);
            }
        } else if (file.name && file.name.endsWith('.cif')) {
            try {
                const structData = await readAsText(file);
                const chains = await getPdbChains(structData, 'mmcif');

                setData({
                    chains,
                    structure: new Blob([structData], {type: 'chemical/x-mmcif'}),
                    name: fileName
                });
                setDataMsg(undefined)
                setDataErr(undefined)
                setMode('structure')
            } catch (err) {
                setData(undefined);
                setDataMsg(undefined);
                setDataErr(err.message || err);
                setMode(undefined);
            }
        } else if (file.name && (file.name.endsWith('.fa') || file.name.endsWith('.fasta'))) {
            try {
                const fastaData = await readAsText(file);
                const seqs = Array.from(fastaParse(fastaData));

                setData({
                    seqs,
                    name: fileName
                });
                setDataMsg(`Loaded ${seqs.length} sequences`);
                setDataErr(undefined);
                setMode('sequences');
            } catch (err) {
                setData(undefined);
                setDataMsg(undefined);
                setDataErr(err.message || err);
                setMode(undefined);
            }
        } else {
            try {
                const raw = await readAsArrayBuffer(file);
                let ss = loadSpreadsheet(raw, file.name.endsWith('.csv') ? 'csv' : 'xlsx');
                let lastNonEmpty = -1;
                for (let i = 0; i < ss.length;  ++i) {
                    if (ss[i] && ss[i].length > 0) {
                        lastNonEmpty = i;
                    }
                }
                if (lastNonEmpty > 0 && lastNonEmpty < ss.length - 1) {
                    ss.splice(lastNonEmpty + 1);
                }

                ss.name = fileName;
                setData(ss);
                setDataMsg(`Loaded ${ss.length} rows`)
                setDataErr(undefined);
                setMode('table');
            } catch (err) {
                setData(undefined);
                setDataMsg(undefined);
                setDataErr(err.message || err);
                setMode(undefined);
            }
        }
    }, [setData, setDataErr, setMode]);

    const onPaste = useCallback(async () => {
        try {
            const data = await tableFromClipboard();

            if (data.length) {
                setData(data);
                setDataMsg(`Pasted ${data.length} rows`);
                setDataErr(undefined);
                setMode('table')
            }
        } catch (err) {
            alert(err?.message || err)
        }
    }, [setData, setDataErr, setMode])

    const Stage2Component = MODE_COMPONENTS[mode];

    return (
        <ThemeProvider theme={theme}>
            <Grid container spacing={2} justifyContent="center" style={{maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto'}}>
                <Grid item xs={12}>
                    <div style={{display: 'flex', justifyContent: 'center'}}>
                        <h2>Upload data</h2>
                    </div>
                    <p>
                        GYDE allows antibody, simple-protein, and protein-complex data to be uploaded as spreadsheets (CSV or XLSX format).
                        You can also upload a single structure (in PDB format) or one or more sequences in FASTA format.
                    </p>


                    <Accordion variant="outlined">
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <h4><ArticleIcon sx={{verticalAlign: 'bottom', paddingRight: '0.5rem'}}/>Supported formats</h4>
                        </AccordionSummary>
                        <AccordionDetails> 
                            <div>
                                GYDE is fairly flexible about how data is provided.  You can upload an existing spreadsheet and
                                hopefully things will work!  If you have a spreadsheet that you think ought to work and doesn't,
                                please contact #gyde-users on Slack.

                                Currently supported column types are:

                                <dl>
                                    <dt>Names/identifier</dt>
                                    <dd>one per dataset, ever row should have a unique value</dd>

                                    <dt>Reference ID</dt>
                                    <dd>Name or identifier of reference/seed sequence.  Should match values in the "names" column</dd>

                                    <dt>Numeric data</dt>
                                    <dd>NA and #N/A are allowed for missing values</dd>

                                    <dt>Other text/data</dt>
                                    <dd>Free form column, can be used for anything</dd>

                                    <dt>Structure URL</dt>
                                    <dd>May be .pdb, .cif, .pdb.gz, or .cif.gz</dd>

                                    <dt>Protein sequence</dt>
                                    <dd>NB the sequence is uppercased and validated</dd>

                                    <dt>Antibody Heavy/Light Chain</dt>
                                    <dd>
                                        Treated as protein sequence, but enables certain antibody-specific features.
                                        Currently only one each of heavy and light chains is permitted per database
                                        (may be relaxed in future, e.g. for bispecific antibodies)
                                    </dd>

                                    <dt>Mutations</dt>
                                    <dd>
                                        Mutation data should be provided in the form <code>X123Y</code>.  There mayb
                                        be more flexibility in the future (e.g. multiple mutations per sequence).  You
                                        will be prompted to provide a reference sequence.
                                    </dd>

                                    <dt>Ligand (SMILES)</dt>
                                    <dd>
                                        SMILES strings.  Will be validated.
                                    </dd>

                                    <dt>Analysis image (URL)</dt>
                                    <dd>
                                        Arbitrary visual data that will be shown when that item is selected.
                                    </dd>

                                    <dt>User notes</dt>
                                    <dd>
                                        User-editable free text
                                    </dd>

                                    <dt>User rating</dt>
                                    <dd>
                                        1-5 values which will be presented as "star" ratings.
                                    </dd>


                                </dl>
                            </div>

                        </AccordionDetails>
                    </Accordion>
                </Grid> 
                <Grid item xs={12}>
                    <h3>1. Upload data</h3>
                </Grid>
                <Grid item xs={3}>
                    <input id="upload-seqs"
                           type="file"
                           accept="text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, chemical/x-pdb, .pdb, chemical/x-mmcif, .cif, chemical/x-mdl-molfile, .sdf, application/fasta, .fa, .fasta"
                           onChange={ selectDataFile }
                           style={{display: 'none'}} />
                    <label htmlFor="upload-seqs">
                        <Button variant="outlined"
                                component="div"
                                style={{textTransform: 'none'}}
                                startIcon={<UploadIcon />}>
                            Upload your speadsheet, CSV, FASTA, or a PDB/mmCIF file
                       </Button> 
                    </label>
                </Grid>
                <Grid item xs={3}>
                    <Button variant="outlined" 
                            startIcon={<PasteIcon />}
                            onClick={onPaste}>
                        OR: paste spreadsheet-formatted data from your clipboard
                    </Button>
                </Grid>
                <Grid item xs={12}>
                    <center>
                        { dataErr 
                            ? <div style={{color: 'red'}}>
                                 { dataErr }
                              </div>
                            : dataMsg
                                ? <div>{ dataMsg }</div>
                                : null }
                    </center>
                </Grid>
                { (Stage2Component && data)
                    ? <React.Fragment>
                            <Grid item xs={12}>
                                <h3>2. Confirm contents</h3>
                            </Grid>
                            <Stage2Component data={data}
                                             mode={mode}
                                             onDataLoad={onDataLoad}
                                             loadedSessions={loadedSessions} />
                      </React.Fragment>
                    : null }
            </Grid>
        </ThemeProvider>
    );
}

function numericValidator(column) {
    let bad = 0;
    for (const v of column) {
        if (typeof(v) !== 'number' && v !== null && v !== undefined && v !== '-' && v !== 'NA' && v !== '#N/A' && Number.isNaN(+v)) {
            ++bad;
        }
    }
    if (bad > 0) {
        return `${bad} items are not numbers or blank`;
    }
}

function ratingColumnValidator(column) {
    let bad = 0;
    for (const r of column) {
        if (r !== undefined && r !== '' && r !== 0 && r !== 1 && r !== 2 && r !== 3 && r !== 4 && r !== 5) {
            ++bad;
        }
    }
    if (bad > 0) {
        return `${bad} items are not 0-5 ratings`;
    }
}

function proteinColumnValidator(column) {
    let bad = 0, good = 0;
    for (const s of column) {
        if (!s || s.length === 0) {
            // skip;
        } else if (/^[ACDEFGHIKLMNPQRSTVWYX-]*$/.exec(s)) {
            ++good;
        } else {
            ++bad;
        }
    }
    if (bad > 0) {
        return `${bad} items are not protein sequences`;
    }
    if (good === 0) {
        return `No protein sequences found`;
    }
}

function dnaColumnValidator(column) {
    let bad = 0, good = 0;
    for (const s of column) {
        if (!s || s.length === 0) {
            // skip;
        } else if (/^[ACGT-]*$/.exec(s)) {
            ++good;
        } else {
            ++bad;
        }
    }
    if (bad > 0) {
        return `${bad} items are not DNA sequences`;
    }
    if (good === 0) {
        return `No DNA sequences found`;
    }
}

function rnaColumnValidator(column) {
    let bad = 0, good = 0;
    for (const s of column) {
        if (!s || s.length === 0) {
            // skip;
        } else if (/^[ACGU-]*$/.exec(s)) {
            ++good;
        } else {
            ++bad;
        }
    }
    if (bad > 0) {
        return `${bad} items are not RNA sequences`;
    }
    if (good === 0) {
        return `No RNA sequences found`;
    }
}

function isSequenceColumnGappy(column) {
    let gappy = 0;
    for (const s of column) {
        if (s && typeof(s) === 'string' && s.indexOf('-') > 0) ++gappy;
    }
    return gappy > 0;
}

function mutationValidator(column, config) {
    if (config?.referenceSequence) {
        let invalid = 0, oor = 0;
        const refLen = config.referenceSequence.length;
        for (const m of column) {
            if (m === 'WT') {
                // ok
            } else {
                const match = /^[A-Z](\d{1,4})([A-Z])$/.exec(m || '');
                if (!match) {
                    ++invalid;
                } else {
                    const position = parseInt(match[1]),
                          mutation = match[2];
                    if (position > refLen) {
                        ++oor;
                    }
                }
            }
        }

        if (invalid) {
            return `${invalid} items do not match R123M format`;
        } else if (oor) {
            return `${oor} items have positions outside the reference sequence`;
        }
    } else {
        return 'A reference sequence must be provided'
    }
}

function MutationColumnUI({update, referenceSequence, useMutationAsName=false, useWTRef=false}) {
    return (
        <React.Fragment>
            <TextField id="refseq"
                       variant="outlined"
                       label="Reference sequence"
                       size="small"
                       value={referenceSequence || ''}
                       onChange ={(ev) => update({referenceSequence: ev.target.value.replace(/\s+/g, '').toUpperCase()})}
                       fullWidth />
            <Grid container>
                <Grid item xs={6}>
                    <FormControlLabel
                              control={<Checkbox name="useMutationAsName"
                                                 checked={useMutationAsName} 
                                                 onChange={(ev) => update({useMutationAsName: ev.target.checked})} />}
                              label="Use mutation as name?"/>
                </Grid>
                <Grid item xs={6}>
                    <FormControlLabel
                              control={<Checkbox name="Use WT as reference?"
                                                 checked={useWTRef} 
                                                 onChange={(ev) => update({useWTRef: ev.target.checked})} />}
                              label="Use WT as reference?"/>
                </Grid>
            </Grid>
        </React.Fragment>
    )
}

function isNameColumn(type, config) {
    if (type === 'name') {
        return true;
    } else if (type === 'mutations') {
        if (config?.useMutationAsName) return true;
    }
    return false;
}

function isSeedColumn(type, config) {
    if (type === 'seed') {
        return true;
    } else if (type === 'mutations') {
        if (config?.useWTRef) return true;
    }
    return false;
}

const COLUMN_TYPES = {
    'name': {
        name: 'Name/identifier',
        // unique: true,
        validator: (column) => {
            const vals = {};
            for (const d of column) {
                if (!d) {
                    return 'Every row must have a name';
                }
                if (vals[d]) {
                    return 'Names must be unique';
                }
                vals[d] = true;
            }
        }
    },
    'seed': {
        name: 'Reference ID',
        unique: true
    },
    'numeric': {
        name: 'Numeric data',
        validator: numericValidator
    },
    'info': {
        name: 'Other text/data',
    },
    'structure': {
        name: 'Structure URL',
    },
    'protein': {
        name: 'Protein sequence',
        validator: proteinColumnValidator,
        isProtein: true,
    },
    'hc': {
        name: 'Antibody Heavy Chain',
        validator: proteinColumnValidator,
        unique: true,
        isProtein: true,
        isAntibody: true
    },
    'lc': {
        name: 'Antibody Light Chain',
        validator: proteinColumnValidator,
        unique: true,
        isProtein: true,
        isAntibody: true
    },
    'mutations': {
        name: 'Mutations',
        validator: mutationValidator,
        extraUI: MutationColumnUI
    },
    'dna': {
        name: 'DNA sequence',
        validator: dnaColumnValidator
    },
    'rna': {
        name: 'RNA sequence',
        validator: rnaColumnValidator
    },
    'smiles': {
        name: 'Ligand (SMILES)'
    },
    'image': {
        name: 'Analysis image (URL)'
    },
    'note': {
        name: 'User notes',
    },
    'rating': {
        name: 'User rating',
        validator: ratingColumnValidator
    },
    'ignore': {
        name: 'Ignore this column'
    }
}

function nameToDefaultType(c, data) {
    data ||= [undefined];
    const clc = c.toLowerCase();
    const tokens = clc.split(/[.:\-_]+/g),
          firstToken = tokens[0],
          lastToken = tokens[tokens.length-1];

    if (c === 'hc_sequence') {
        return 'hc';
    } else if (c === 'lc_sequence') {
        return 'lc';
    } else if ((firstToken === 'sequence' || lastToken === 'sequence') && !proteinColumnValidator(data)) {
        return 'protein';
    } else if ((firstToken === 'protein' || lastToken === 'protein') && !proteinColumnValidator(data)) {
        return 'protein';
    } else if (clc.endsWith('structure_url')) {
        return 'structure';
    } else if (clc === 'seed' || clc === 'reference') {
        return 'seed';
    } else if (clc === 'concept_name' || clc === 'name') {
        return 'name';
    }

    let numeric = false, nonNumeric = false;
    for (const v of data || []) {
        if (typeof(v) === 'number' || !Number.isNaN(+v)) {
            numeric = true;
        } else if (v !== null && v !== undefined && v !== '-' && v !== 'NA' && v !== '#N/A') {
            nonNumeric = true;
        }
    }
    if (numeric && !nonNumeric) {
        return 'numeric';
    }

    return 'info';
}

function deleteFromArray(a, item) {
    const i = a.indexOf(item);
    if (i >= 0) {
        a.splice(i, 1);
    }
}

const PREVIOUS_INIT = Symbol('PREVIOUS_INIT');


export function DataTableConfigurator({
    rawData,
    columnarData: managedColumnarData,
    dataRowCount: managedDataRowCount,
    dataColumns: managedDataColumns,
    callback,
    blueMode=false,
    includeTrims=false,
    includeAlignmentOptions=false,
    syntheticNames=true,
    initialTypes,
    constrainToSequence=[],
    name
}) {
    const [skipBeforeHeaderStr, setSkipBeforeHeaderStr] = useState('0'),
          [skipAfterHeaderStr, setSkipAfterHeaderStr] = useState('0');

    const skipBeforeHeaderEnt = parseInt(skipBeforeHeaderStr) || 0,
          skipAfterHeaderEnt = parseInt(skipAfterHeaderStr) || 0,
          skipBeforeHeader =rawData ? Math.min(skipBeforeHeaderEnt, rawData.length - 1) : 0,
          skipAfterHeader = rawData ? Math.min(skipAfterHeaderEnt, rawData.length - 1 - skipBeforeHeader) : 0;

    const {columnarData, dataColumns, dataRowCount} = useMemo(() => {
        if (managedColumnarData) {
            return {
                columnarData: managedColumnarData,
                dataColumns: managedDataColumns || Object.keys(managedColumnarData),
                dataRowCount: managedDataRowCount
            };
        }

        const header = rawData[skipBeforeHeader];
        const dataRows = [...rawData];
        dataRows.splice(0, skipBeforeHeader + 1 + skipAfterHeader);
        const jData = convertToJson(header, dataRows);
        const columnarData = jData.length ? aosToSoaInclusive(jData) : {};
        return {
            columnarData,
            dataColumns: jData.columns,
            dataRowCount: dataRows.length
        };
    }, [rawData, skipBeforeHeader, skipAfterHeader, managedColumnarData]);

    const [columnTypes, updateColumnType] = useReducer(
        (columnTypes, {action, value, name, type}) =>  {
            if (action === 'reset') {
                const nct =  {
                    [PREVIOUS_INIT]: value,
                    ...value
                };
                const prev = columnTypes[PREVIOUS_INIT] || {};
                for (const [k, v] of Object.entries(columnTypes)) {
                    if (value[k] && prev[k] === value[k]) {
                        nct[k] = columnTypes[k];
                    }
                }
                return nct;
            } else {
                return {...columnTypes, [name]: type}
            }
        },
        initialTypes || {},
    );

    // Need useLayoutEffect here to avoid consumers getting a "bad" dataset before the default
    // types are set.  useLayoutEffect is a really misleading name...
    useLayoutEffect(() => {
        const columnTypes = {};
        for (const c of dataColumns) {
            columnTypes[c] = (initialTypes || {})[c] || nameToDefaultType(c, columnarData[c]);
        }
        updateColumnType({action: 'reset', value: columnTypes})
    }, [dataColumns, columnarData, initialTypes]);

    const [columnSpecificConfig, updateColumnSpecificConfig] = useReducer(
        (columnSpecificConfig, {name, update}) => ({
            ...columnSpecificConfig,
            [name]: {...(columnSpecificConfig[name] || {}), ...update}
        }),
        {}
    );

    const columnUpdaters = useMemo(() => {
        const columnUpdaters = {};
        for (const c of dataColumns) {
            columnUpdaters[c] = (update) => updateColumnSpecificConfig({name: c, update})
        }
        return columnUpdaters;
    }, [dataColumns])

    const [aliType, setAliType] = useState('seqs');

    const {columnErrors, comboErrors, isProtein, isAntibody, nameColumn, seedColumn, isGappy} = useMemo(() => {
        const columnErrors = {};
        const comboErrors = [];
        let isProtein = false, isAntibody = false, isGappy = false;

        const typeSpectrum = {};
        const nameColumns = [],
              seedColumns = [];

        for (const [columnKey, columnType] of Object.entries(columnTypes)) {
            typeSpectrum[columnType] = (typeSpectrum[columnType] ?? 0) + 1;
            const columnTypeDesc = COLUMN_TYPES[columnType];
            if (columnTypeDesc?.validator) {
                columnErrors[columnKey] = columnTypeDesc.validator(columnarData[columnKey] || [], columnSpecificConfig[columnKey]);
            }
            isProtein = isProtein || columnTypeDesc.isProtein;
            isAntibody = isAntibody || columnTypeDesc.isAntibody;

            if (columnTypeDesc.isProtein && !columnErrors[columnKey]) {
                isGappy ||= isSequenceColumnGappy(columnarData[columnKey]);
            }

            if (isNameColumn(columnType, columnSpecificConfig[columnKey])) {
                nameColumns.push(columnKey);
            }

            if (isSeedColumn(columnType, columnSpecificConfig[columnKey])) {
                seedColumns.push(columnKey);
            }
        }

        if (nameColumns.length > 1) {
            comboErrors.push('Can only use one column for names');
        }

        for (const [type, desc] of Object.entries(COLUMN_TYPES)) {
            if (typeSpectrum[type] > 1 && desc.unique) {
                comboErrors.push(`Can only have one column of type ${desc.name || type}`);
            }
        }

        return {
            columnErrors,
            comboErrors,
            isProtein,
            isAntibody,
            isGappy,
            nameColumn: nameColumns[0],
            // can't use "seedColumns" here because we also count mutation columns with WT seed.
            seedColumn: Object.entries(columnTypes).filter((_, type) => type === 'seed').map((c, _) => c)[0]
        };
    }, [columnarData, columnTypes, columnSpecificConfig])

    let validAliType = aliType;
    if (!isAntibody && validAliType === 'anarciSeqs') {
        validAliType = 'alignedSeqs';
    }
    if (!isProtein) {
        validAliType = 'seqs';
    } else if (isGappy) {
        validAliType = 'pre';
    }

    const dataset = useMemo(() => {
        const data = {...columnarData};
        const dsDataColumns = [...dataColumns];
        const freeName = (n) => {
            while (data[n]) n = '_' + n;
            return n;
        }

        let dsNameColumn = nameColumn,
            dsSeedColumn = seedColumn;

        if (dsNameColumn) {
            data[dsNameColumn] = (data[dsNameColumn] || []).map((i) => i ? ('' + i) : '');
        } else if (syntheticNames) {
            dsNameColumn = freeName('name');
            data[dsNameColumn] = [];
            for (let i = 0; i < dataRowCount; ++i) {
                data[dsNameColumn].push(`Sequence ${i + 1}`);
            }
        }

        for (const [key, type] of Object.entries(columnTypes)) {
            if (type === 'ignore') {
                delete data[key];
            }
        }

        for (let i = dsDataColumns.length - 1; i >= 0; --i) {
            if (!data[dsDataColumns[i]]) {
                dsDataColumns.splice(i, 1);
            }
        }
        for (const c of Object.keys(data)) {
            if (dsDataColumns.indexOf(c) < 0) {
                dsDataColumns.push(c);
            }
        }

        const dataset = {
            columnarData: data,
            dataColumns: dsDataColumns,
            dataRowCount,
            name: name ?? rawData?.name,
            isAntibody: false,
            sequenceTableHeader: 'Sequences',
            seqColumns: [],
            msaColumns: validAliType === 'pre' ? [] : undefined,
            alignmentKey: validAliType === 'pre' ? 'alignedSeqs' : validAliType,
            specialAlign: validAliType === 'pre' ? 'Pre-aligned' : undefined,
            structureKeys: [],
            analysisImageFields: [],
            analysisImageNames: [],
            nameColumn: dsNameColumn,
            refNameColumn: dsSeedColumn || null,
            columnTypes: {}
        };

        for (const [key, type] of Object.entries(columnTypes)) {
            const config = columnSpecificConfig[key] || {};

            let seqKey = key;
            if (type === 'protein' || type === 'hc' || type === 'lc' || type === 'dna' || type === 'rna') {
                if (validAliType === 'pre') {
                    seqKey = freeName(key + '_base');
                    dataset.dataColumns.push(seqKey);
                    dataset.columnarData[seqKey] = dataset.columnarData[key].map((a) => {
                        if (!a) return;
                        if (typeof(a) === 'string') {
                            return a.replace(/-/g, '');
                        }
                    });

                    let maxLen = 0;
                    for (const s of dataset.columnarData[key]) {
                        if (!s || typeof(s) !== 'string') continue;
                        maxLen = Math.max(maxLen, s.length);
                    }
                    const numbering = [];
                    for (let i = 0; i < maxLen; ++i) numbering.push(`${i+1}`);
                    dataset.msaColumns.push({column: key, numbering});
                }
            }

            if (type === 'protein') {
                dataset.seqColumns.push({column: seqKey});
            } else if (type === 'hc') {
                dataset.seqColumns.push({column: seqKey});
                dataset.hcColumn = seqKey;
                dataset.isAntibody = true;
            } else if (type === 'lc') {
                dataset.seqColumns.push({column: seqKey});
                dataset.lcColumn = seqKey;
                dataset.isAntibody = true;
            } else if (type === 'dna') {
                dataset.seqColumns.push({column: seqKey});
                dataset.columnTypes[key] = 'dna';
            } else if (type === 'rna') {
                dataset.seqColumns.push({column: seqKey});
                dataset.columnTypes[key] = 'rna';
            } else if (type === 'mutations') {
                const refKey = freeName(key + '_base');

                const refSeq = columnSpecificConfig[key]?.referenceSequence || '';
                dataset.columnarData[key] = (dataset.columnarData[key] || [])?.map((m) => {
                    if (m === 'WT') {
                        return refSeq; 
                    }
                    const match = /^[A-Z](\d{1,4})([A-Z])$/.exec(m || '');
                    if (!match) {
                        return '-';
                    }
                    const position = parseInt(match[1]),
                          mutation = match[2];
                    return substitute(refSeq, position, mutation);
                });

                dataset.seqColumns.push({column: key});

                if (config.useWTRef && !dsSeedColumn) {
                    dsSeedColumn = dataset.refNameColumn = freeName('ref_name');
                    dataset.columnarData[dsSeedColumn] = dataset.columnarData[key].map((_) => 'WT');
                    dsDataColumns.push(dsSeedColumn);
                }
            } else if (type === 'structure') {
                data[key] = data[key]?.map(urlFix);
                dataset.structureKeys.push(key);
            } else if (type === 'image') {
                data[key] = data[key]?.map(urlFix);
                dataset.structureKeys.push(key);
                dataset.analysisImageFields.push(key);
                dataset.analysisImageNames.push(key);
            } else if (type === 'seed') {
                dataset.columnarData[key] = dataset.columnarData[key]?.map((i) => i ? ('' + i) : '');
            } else if (type === 'smiles') {
                dataset.columnTypes[key] = 'smiles';
            } else if (type === 'note') {
                dataset.columnTypes[key] = 'note';
            } else if (type === 'rating') {
                dataset.columnTypes[key] = 'rating';
            } else if (type === 'numeric') {
                dataset.columnTypes[key] = 'numeric';
                data[key] = data[key]?.map((v) => {
                    const vv = +v;
                    return Number.isNaN(vv) ? v : vv;
                });
            } else if (type === 'info') {
                dataset.columnTypes[key] = 'info';
                data[key] = data[key]?.map((v) => typeof(v) === 'number' ? (''+v) : v);
            }
        }

        return dataset;
    }, [columnarData, columnTypes, columnSpecificConfig, aliType, isProtein, isAntibody])

    useEffect(() => {
        if (callback) {
            callback(dataset, !(comboErrors.length || Object.values(columnErrors).filter((x) => x).length));
        }
    }, [dataset, comboErrors, columnErrors, callback]);

    return (
        <Grid container>
            <Grid item xs={12} container>
                { includeTrims 
                  ? <React.Fragment>
                        <Grid item xs={6}>
                            <TextField id="skipBefore"
                                       sx={{paddingBottom: '0.5rem'}}
                                       variant='outlined'
                                       label="Skip rows before header"
                                       value={skipBeforeHeaderStr}
                                       onChange={(ev) => setSkipBeforeHeaderStr(ev.target.value.replace(/[^\d]/g, ''))}
                                       error={skipBeforeHeader !== skipBeforeHeaderEnt}
                                       helperText={skipBeforeHeader !== skipBeforeHeaderEnt ? `Limited to ${skipBeforeHeader}` : undefined}
                                       fullWidth />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField id="skipAfter"
                                       variant='outlined'
                                       label="Skip rows after header"
                                       value={skipAfterHeaderStr}
                                       onChange={(ev) => setSkipAfterHeaderStr(ev.target.value.replace(/[^\d]/g, ''))}
                                       error={skipAfterHeader !== skipAfterHeaderEnt}
                                       helperText={skipAfterHeader !== skipAfterHeaderEnt ? `Limited to ${skipAfterHeader}` : undefined}
                                       fullWidth />
                        </Grid>
                    </React.Fragment>
                  : undefined }
                <Grid item xs={12}>
                    <Paper
                        elevation={6}
                        sx={{padding: '1rem'}}
                    >
                        <Grid container>
                            <Grid item xs={3}><h3>Column</h3></Grid>
                            <Grid item xs={3}><h3>Column meaning</h3></Grid>
                            <Grid item xs={6}><h3>Errors/notes/config</h3></Grid>
                            <Grid container sx={{maxHeight: 500, overflowY: 'scroll'}}>
                                { dataColumns.map((c) => {
                                    const columnInfo = COLUMN_TYPES[columnTypes[c]] || {},
                                          ExtraUI = columnInfo.extraUI;

                                    return (
                                        <React.Fragment key={c}>
                                            <Grid item xs={3} style={{display: 'flex', flexDirection: 'column', paddingTop: '0.5rem'}}>
                                                <div>{c}</div>
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Select id="type"
                                                        MenuProps={blueMode ? {PaperProps: {'sx': {background: '#153452'}}} : undefined}
                                                        size="small"
                                                        value={ columnTypes[c] || 'info' }
                                                        fullWidth
                                                        onChange={(ev) => updateColumnType({name: c, type: ev.target.value})}>
                                                    { Object.entries(COLUMN_TYPES).map(([ck, cl]) => (
                                                        <MenuItem sx={blueMode ? menuItemStyle : undefined} 
                                                                  key={ ck } 
                                                                  value={ ck } 
                                                                  disabled={cl.disabled || (constrainToSequence.indexOf(c) >= 0 && !cl.isProtein)}>
                                                            { cl.name }
                                                        </MenuItem>
                                                    )) }
                                                </Select>
                                            </Grid>
                                            <Grid item xs={6} style={{paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                                                { ExtraUI 
                                                    ? <ExtraUI column={c}
                                                               update={columnUpdaters[c]}
                                                               {...(columnSpecificConfig[c] || {})} />
                                                    : undefined }
                                                { columnErrors[c] 
                                                    ? <div style={{color: 'red'}}>{columnErrors[c]}</div> 
                                                    : undefined }                                    
                                            </Grid>
                                        </React.Fragment>
                                    );
                                }) }
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>
            <Grid item xs={12}>
                { comboErrors.map((e, i) => (
                    <div key={i} style={{color: 'red'}}>{ e }</div>
                )) }
            </Grid>
            { includeAlignmentOptions
              ? <Grid item xs={12} sx={{marginTop: '1rem'}}>
                    <FormControl>
                        <InputLabel id="dstype-label">Alignment:</InputLabel>
                        <Select labelId="dstype-label"
                                id="dstype"
                                value={validAliType}
                                label="Alignment"
                                disabled={!isProtein}
                                onChange={(ev) => setAliType(ev.target.value)} >
                            <MenuItem sx={menuItemStyle} disabled={isGappy} value="seqs">Do not align</MenuItem>
                            <MenuItem sx={menuItemStyle} value="pre">Pre-alignment</MenuItem>
                            <MenuItem sx={menuItemStyle} disabled={isGappy} value="alignedSeqs">Align with MAFFT</MenuItem>
                            <MenuItem sx={menuItemStyle} value="anarciSeqs" disabled={!isAntibody || isGappy}>Align with antibody Kabat numbering</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
              : undefined }

        </Grid>
    );
}

function DataTableUpload({
    data: rawData, onDataLoad,
    loadedSessions=[]
}) {
    const [dataset, setDataset] = useState();
    const [datasetValid, setDatasetValid] = useState(false);
    const datasetCallback = useCallback((dataset, valid) => {
        setDataset(dataset);
        setDatasetValid(valid);
    }, []);

    const pinger = usePinger();
    const handleSubmit = useCallback(() => {
        pinger('dataset.upload');
        onDataLoad(undefined, dataset);
    }, [dataset])

    const [mergeDatasetKey, setMergeDatasetKey] = useState('__none__');
    const [mergedSession, setMergedSession] = useState();
    const [mergeIssues, setMergeIssues] = useState();

    const createTabFromMerged = useCallback(() => {
        const newSession = {
            ...(mergedSession || []),
            name: `${session.name} X ${dataset.name}`
        };
        delete newSession.id;
        delete newSession.showSetupMerge;
        delete newSession._external_id;
        delete newSession._gyde_readonly;
        delete newSession.updateTabProps;

        onDataLoad(undefined, newSession);
    }, [mergedSession, onDataLoad]);

    const session = loadedSessions.filter((s) => s.id === mergeDatasetKey)[0];

    return (
        <React.Fragment>
            <Grid item>
                <DataTableConfigurator rawData={rawData}
                                       callback={datasetCallback}
                                       blueMode
                                       includeTrims
                                       includeAlignmentOptions />

            </Grid>
            <Grid item xs={4}>
                <Button variant="contained" 
                        color="primary" 
                        disabled={ !datasetValid }
                        onClick={ handleSubmit }>
                    Create GYDE dataset
                </Button>
            </Grid>
            <Grid item xs={4}>
                <FormControl>
                    <InputLabel id="mds-label">
                        { loadedSessions.length
                            ? "OR merge with dataset"
                            : "Open another dataset to merge" }
                    </InputLabel>
                    <Select sx={{minWidth: '20rem'}}
                            margin="dense"
                            labelId="mds-label"
                            label="OR merge with dataset"
                            value={mergeDatasetKey}
                            disabled={loadedSessions.length === 0}
                            onChange={(ev) => setMergeDatasetKey(ev.target.value)}>
                        <MenuItem sx={menuItemStyle} value="__none__">NONE (show preview)</MenuItem>
                        { loadedSessions.map((s) => (
                            <MenuItem sx={menuItemStyle} key={s.id} value={s.id}>{s.name}</MenuItem>
                        )) }
                    </Select>
                </FormControl>
            </Grid>
            {!session
              ? <Grid item xs={12} style={{paddingBottom: '1rem'}}>
                    { dataset ? <DatasetPreview {...dataset} /> : undefined }
                </Grid>
              : <Grid item xs={12}>
                    <BindConfig key={session.id} 
                                thisSession={dataset}
                                extSession={session}
                                resultCallback={(session, issues) => {
                                   setMergedSession(session);
                                   setMergeIssues(issues);
                                }} />
                    <Button sx={{marginTop: '0.5rem', marginBottom: '1rem'}}
                            variant="contained"
                            onClick={ createTabFromMerged }
                            disabled={!mergedSession || mergeIssues?.length}>
                        Create merged dataset
                    </Button>
                </Grid> }
        </React.Fragment>
    );
}

function StructureUpload({data, onDataLoad}) {
    const chainList = useMemo(() => {
        const chainList = Object.keys(data.chains);
        chainList.sort();
        return chainList;
    }, [data]);

    const [includeChains, updateIncludeChains] = useReducer(
        (chains, update) => ({...chains, ...update}),
        chainList,
        (chainList) => {
            const chains = {};
            for (const c of chainList) chains[c] = true;
            return chains;
        }
    );

    const pinger = usePinger();

    const handleSubmit = useCallback(() => {
        const seqColumns = [],
              seqColumnNames = [],
              structureChains = [],
              structureResNum = [];

        // TODO: should probably just call this 'structure' without the _url
        const columnarData = {
            seqid: [data.name],
            concept_name: [data.name],
            structure_url: [data.structure],
            __candidate_for_mpnn: [true]
        }

        for (const chain of chainList) {
            if (includeChains[chain]) {
                const seqColumn = '_gyde_seq_' + chain;
                columnarData[seqColumn] = [data.chains[chain].mpnnAtomicSequence];
                seqColumns.push({
                    column: seqColumn,
                    numbering: data.chains[chain].mpnnNumbering
                });
                seqColumnNames.push('Chain ' + chain);
                structureChains.push(chain);
                structureResNum.push(data.chains[chain].mpnnNumbering.map((r) => ({value: {residueNumber: r}})));
            }
        }

        if (structureChains.length > 0) {
            data.structure._gyde_chains = structureChains;
            columnarData.structure_url = [data.structure];
            // columnarData.structure_residue_numbering = [structureResNum];
        }

        pinger('dataset.upload.structure');

        onDataLoad(undefined, {
            name: data.name,
            columnarData,
            alignmentKey: 'seqs',
            seqColumns,
            seqColumnNames,
            isAntibody: false,
            specialAlign: 'Not aligned',        // NB currently prevents auto-MSA
            sequenceTableHeader: 'Sequences',
            structureKey: 'structure_url',
        });
    }, [data, onDataLoad, includeChains, chainList, pinger]);

    return (
        <React.Fragment>
            <Grid item xs={12}>
                <p>
                    This looks like a PDB structure.  Select which chain(s) you wish to include.
                </p>
            </Grid>

            <Grid item xs={12}>
            { chainList.map((chain) => (
                <div key={chain}> 
                  <FormControlLabel
                      control={<Checkbox name={`chain-${chain}`}
                                         checked={includeChains[chain]} 
                                         onChange={(ev) => {updateIncludeChains({[chain]: ev.target.checked})}} />}
                      label={<span>
                        Chain {chain}
                        {(data.chains[chain].rawAtomicSequence !== data.chains[chain].mpnnAtomicSequence)
                        ? <div>[WARNING: gaps in residue numbering.  GYDE currently inserts "X" characters for compatibility with ProteinMPNN]</div>
                        : undefined }
                      </span>} />

                </div>
            )) }
            </Grid>

            <Grid item xs={12}>
                <Button variant="contained" 
                        color="primary" 
                        onClick={handleSubmit}>
                    Create GYDE dataset
                </Button>
            </Grid>
        </React.Fragment>
    )
}

function SdfUpload({data, onDataLoad}) {
    const pinger = usePinger();

    const handleSubmit = useCallback(() => {
        const {sdfProperties, structure} = data;

        const records = sdfProperties.map((props, index) => ({
            seqid: data.name + ':' + index,
            ...props,
            structure_url: structure,
            _structure_url_type: 'sdf',
            _structure_index: index
        }));
        records.columns = ['seqid', 'concept_name', ...sdfProperties.columns];

        // const alignedHeavy = records.map((r) => ({name: r.seqid, seq: r.HC_sequence}));
        // alignedHeavy.residueNumbers = alignedHeavy[0].seq.split('').map((_, i) => (i+1).toString());

        pinger('dataset.upload.sdf');

        onDataLoad(records, {
            name: data.name,
            alignmentKey: 'alignedSeqs',
            // alignedHeavy,
            ccLabel: 'Molecule',
            isAntibody: false,
            specialAlign: 'Not aligned',
            sequenceTableHeader: 'Molecules',
            seqColumns: []
        });
    }, [data, onDataLoad, pinger]);

    return (
        <React.Fragment>
            <Grid item xs={12}>
                <p>
                    This looks like small molecules in SDF format.  Support for this is experimental!
                </p>

            </Grid>
            <Grid item xs={12}>
                <Button variant="contained" 
                        color="primary" 
                        onClick={handleSubmit}>
                    Create GYDE dataset
                </Button>
            </Grid>
        </React.Fragment>
    )
}

function SequenceUpload({data: {seqs, name}, onDataLoad}) {
    const [dataset, setDataset] = useState();
    const [datasetValid, setDatasetValid] = useState(false);
    const datasetCallback = useCallback((dataset, valid) => {
        setDataset(dataset);
        setDatasetValid(valid);
    }, []);

    const {columnarData, dataColumns, dataRowCount, nameColumn, seqColumn, initialTypes} = useMemo(() => {
        const names = [],
              descs = [],
              kvs = [];
        let kvMatched = true;

        for (const {description} of seqs) {
            const space = description.indexOf(' ');
            const name = space < 0 ? description : description.substring(0, space),
                  desc = space < 0 ? '' : description.substring(space+1).trim();

            const kv = {};
            if (desc.length > 0) {
                for (const seg of desc.split(';')) {
                    let eq = seg.indexOf('=');
                    if (eq < 0) {
                        kvMatched = false;
                    } else {
                        kv[seg.substring(0, eq).trim()] = seg.substring(eq+1).trim();
                    }
                }
            }
            names.push(name);
            descs.push(desc);
            kvs.push(kv);
        }

        let columnarData = {};

        if (kvMatched) {
            columnarData = aosToSoaInclusive(kvs);
        } else {
            columnarData.description = descs;
        }

        const freeName = (n) => {
            while (columnarData[n]) n = '_' + n;
            return n;
        }

        const finalColumnarData = {};
        const seqColumn = freeName('sequence');
        finalColumnarData[seqColumn] = seqs.map(({seq}) => seq);
        const nameColumn = freeName('name');
        finalColumnarData[nameColumn] = names;
        Object.assign(finalColumnarData, columnarData);

        return {
            columnarData: finalColumnarData,
            dataRowCount: seqs.length,
            dataColumns: Object.keys(finalColumnarData),
            nameColumn,
            seqColumn,
            initialTypes: {[nameColumn]: 'name', [seqColumn]: 'protein'}
        }
    }, [seqs, name]);


    const pinger = usePinger();
    const handleSubmit = useCallback(() => {
        pinger('dataset.upload.fasta');
        onDataLoad(undefined, dataset);
    }, [dataset])

    return (
        <React.Fragment>
            <Grid item xs={12}>
                <p>
                    <DataTableConfigurator name={name}
                                           columnarData={columnarData}
                                           dataColumns={dataColumns}
                                           dataRowCount={dataRowCount} 
                                           initialTypes={initialTypes}
                                           callback={datasetCallback}
                                           blueMode
                                           includeAlignmentOptions
                                           constrainToSequence={[seqColumn]} />
                </p>

            </Grid>
            <Grid item xs={12}>
                <Button variant="contained" 
                        color="primary" 
                        onClick={handleSubmit}>
                    Create GYDE dataset
                </Button>
            </Grid>
            <Grid item xs={12} style={{paddingBottom: '1rem'}}>
                    { dataset ? <DatasetPreview {...dataset} /> : undefined }
            </Grid>
        </React.Fragment>
    );
}

const MODE_COMPONENTS = {
    'table': DataTableUpload,
    'structure': StructureUpload,
    'sdf': SdfUpload,
    'sequences': SequenceUpload
}