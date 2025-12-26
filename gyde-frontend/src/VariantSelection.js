import React from "react";
import { Button, Stack, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Tooltip } from "@mui/material";
import { Download, Science, Close } from "@mui/icons-material";
import { csvFormatRows } from "d3";
import { saveAs } from 'file-saver';

import {translateDNA} from './utils/sequence';

const VariantSelection = (props) => {
    const {isActive, toggleIsActive, stagedMutations, setStagedMutations, acceptedVariants, setAcceptedVariants} = props;

    const removeVariant = (index) => {
        setStagedMutations(stagedMutations.toSpliced(index, 1));
    }

    const acceptStagedMutations = () => {
        const variantInfo = {}; // Dict<chain, variantString>
        const mutations = {};

        stagedMutations.forEach((mutation) => {
            const chain = mutation.chain;

            if (!mutations[chain]) {
                mutations[chain] = [];
            }

            mutations[chain].push(mutation)
        })

        const newAcceptedVariants = [...acceptedVariants, mutations];

        setAcceptedVariants(newAcceptedVariants);
        setStagedMutations([]);
    }

    return (
        <Stack direction='row' gap='5px'>
            <Button 
                onClick={toggleIsActive}
                sx={{
                    backgroundColor: isActive ? 'primary.blue' : '#ddd',
                    color: isActive? 'white' : '#333333',
                    borderRadius: '10px',
                    ':hover': {backgroundColor: isActive ? 'primary.lightBlue' : '#bce'}
                }}
            >
                Select variants
            </Button>
            { isActive ?
                <Button 
                    onClick={acceptStagedMutations}
                    disabled={stagedMutations.length === 0}
                    sx={{
                        backgroundColor: 'primary.blue',
                        borderRadius: '10px',
                        color: 'white',
                        ':hover': {backgroundColor: 'primary.lightBlue'},
                        ':disabled': {backgroundColor: '#ddd'}
                    }}
                >
                    Add to picklist
                </Button>
                : null
            }
        </Stack>
    )
}

function mutationsToString(mutations) {
    if (!mutations) return '';

    return mutations.map((m) => m.name).reduce((prev, curr, index) => {
            const space = (index === 0) ? `` : '_';
            return prev + space + `${curr}`;
    }, '');
}

export function exportVariantsCSV(acceptedVariants) {
    const columns = ['GPID'];
    const rows = [];

    acceptedVariants.forEach((variant) => {
        const row = ['NA'];   // Should we be filling this in?

        Object.keys(variant).forEach((chain) => {
            if (!columns.includes(chain)) columns.push(chain);
        });

        columns.forEach((name, index) => {
            if (index===0) return;
            row.push(mutationsToString(variant[name]));
        })

        rows.push(row);
    })

    let result = [columns].concat(rows);

    const fileBlob = new Blob([csvFormatRows(result)], {type: 'text/csv'});
    saveAs(fileBlob, `variants.csv`);
}

function indexAlong(ali, n) {
    let a = 0;
    for (let i = 0; i < n; ++i) {
        if (ali[i] !== '-') ++a;
    }
    return a;
}

function exportVariantsDNA(acceptedVariants, seqColumns, seqColumnNames, columnarData, nameColumn, refNameColumn, alignments) {
    try {
        seqColumnNames = seqColumns.map((_, i) => seqColumnNames[i] || `Sequence ${i + 1}`);
        const conceptNames = columnarData[nameColumn],
              seedNames = columnarData[refNameColumn];
        if (!conceptNames) throw Error('Missing names')
        if (!seedNames) throw Error('Missing seeds')
        
        const itemIndex = {};
        conceptNames.forEach((name, i) => {itemIndex[name] = i});

        const seqColIDs = [],
              seqColMap = {};
        for (const variant of acceptedVariants) {
            for (const chain of Object.keys(variant)) {
                const ci = seqColumnNames.indexOf(chain);
                if (ci < 0) throw Error('Failed to identify column ' + chain);
                const columnId = seqColumns[ci].column;
                if (seqColIDs.indexOf(columnId) < 0) {
                    seqColIDs.push(columnId);
                    seqColMap[columnId] = chain;
                }
            }
        }

        const columns = ['GPID'];
        for (const ci of seqColIDs) {
            const cn = seqColMap[ci];
            columns.push(cn + ' mutations');
        }
        for (const ci of seqColIDs) {
            const cn = seqColMap[ci];
            columns.push(cn + ' sequence');
        }

        const rows = [];
        const seenUnknowns = new Set();
        acceptedVariants.forEach((variant) => {
            const row = ['NA'];   // Should we be filling this in?

            seqColIDs.forEach((ci) => {
                const cn = seqColMap[ci];
                row.push(mutationsToString(variant[cn]));
            });
 
            seqColIDs.forEach((ci) => {
                const colIndex = seqColumns.findIndex(({column}) => column === ci);
                const cn = seqColMap[ci];
                const mutations = variant[cn];
                if (!mutations || mutations.length === 0) return;

                let seedItem = null;
                for (const m of mutations) {
                    if (!m.presentInItems || m.presentInItems.length === 0) {
                        continue;
                    }
                    const item = m.presentInItems[0];
                    if (typeof(itemIndex[seedNames[item]]) !== 'number') throw Error('Cannot export DNA when no seed is found for a variant: ' + m.name);
                    if (seedItem !== null && seedItem !== itemIndex[seedNames[item]]) {
                        throw Error('Cannot export DNA when variants don not share a seed');
                    } else {
                        seedItem = itemIndex[seedNames[item]]
                    }
                }

                if (seedItem === null) {
                    let seedName = null;
                    for (const s of seedNames) {
                        if (!s) continue;
                        if (seedName !== null && s !== seedName) {
                            throw Error('Ambiguous reference sequence');
                        } else {
                            seedName = s;
                        }
                    }
                    if (seedName) {
                        seedItem = itemIndex[seedName]
                    }
                }

                if (seedItem === null) {
                    throw Error('Unable to find a reference sequence');
                }

                let sequence = columnarData[ci][seedItem];
                const seedTranslation = translateDNA(sequence);
                const seedAligned = alignments[colIndex][seedItem].replace(/-/g, '');
                const seedOffset = seedTranslation.indexOf(seedAligned);
                if (seedOffset < 0) {
                    throw Error('Could not map back from alignment to sequence [ref]');
                }

                
                for (const m of mutations) {
                    const seqIndex = seedOffset + indexAlong(alignments[colIndex][seedItem], m.x)

                    if (!m.presentInItems || m.presentInItems.length === 0) {
                        seenUnknowns.add(m.name);
                        sequence = sequence.substring(0, seqIndex*3) + '{' + m.to + '}' + sequence.substring((seqIndex+1)*3);        
                    } else {
                        const item = m.presentInItems[0];
                        const altSequence = columnarData[ci][item];
                        const altAligned = alignments[colIndex][item].replace(/-/g, '');
                        const altOffset = translateDNA(altSequence).indexOf(altAligned);
                        if (altOffset < 0) {
                            throw Error('Could not map back from alignment to sequence [alt]');
                        }
                        
                        const altIndex = altOffset + indexAlong(alignments[colIndex][item], m.x)

                        //console.log('Replacing ' + sequence.substring(seqIndex*3, (seqIndex+1)*3) + ' -> ' + altSequence.substring(altIndex*3, (altIndex+1)*3))

                        sequence = sequence.substring(0, seqIndex*3) + altSequence.substring(altIndex*3, (altIndex+1)*3) + sequence.substring((seqIndex+1)*3);
                    }
                }

                row.push(sequence);
                /*
                {
                    const oldTL = seedTranslation,
                          newTL = translateDNA(sequence);
                    console.log(oldTL)
                    console.log(newTL)
                    console.log(oldTL.split('').map((o, i) => o === newTL[i] ? ' ' : '*').join(''));
                }
                */
            });

            rows.push(row);
        })
        if (seenUnknowns.size > 0) {
            alert('Could not find example sequences for some variants, using {X} placeholders instead ' + Array.from(seenUnknowns).join(','))
        }
        

        let result = [columns].concat(rows);

        const fileBlob = new Blob([csvFormatRows(result)], {type: 'text/csv'});
        saveAs(fileBlob, `dna.csv`);
    } catch (err) {
        alert(err.message || err);
    }
}


export const ShoppingCart = (props) => {
    const {
        acceptedVariants, setAcceptedVariants, seqColumns, seqColumnNames = [], columnarData, isDNA, alignments,
        nameColumn = 'concept_name', refNameColumn = 'seed'
    } = props;
    const tableColumnNames = seqColumns.map((_, i) => seqColumnNames[i] || `Sequence ${i + 1}`);

    const removeVariant = (index) => {
        setAcceptedVariants(acceptedVariants.toSpliced(index, 1));
    }

    return (
        <Stack>
            <Stack direction="row">
                <Tooltip title='Export variants into a .csv file'>
                    <Button
                        onClick={() => exportVariantsCSV(acceptedVariants)}
                    >
                        <Download />
                    </Button>
                </Tooltip>
                <Tooltip title='Export variants and DNA sequences into a .csv file'>
                    <Button
                        disabled={!isDNA}
                        onClick={() => exportVariantsDNA(acceptedVariants, seqColumns, seqColumnNames, columnarData, nameColumn, refNameColumn, alignments)}
                    >
                        <Science />
                    </Button>
                </Tooltip>
            </Stack>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell></TableCell>
                            { tableColumnNames.map((name, i) => (
                                    <TableCell key={i}>
                                        {name}
                                    </TableCell>
                                ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {acceptedVariants.map((variant, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Button
                                        onClick={() => removeVariant(index)}
                                    >
                                        <Close/>
                                    </Button>
                                </TableCell>
                                { tableColumnNames.map((chain, i) => (
                                    <TableCell key={i}>
                                        {mutationsToString(variant[chain])}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Stack> 
    )
}

export default VariantSelection;