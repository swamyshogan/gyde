import React, { useState, useEffect, useMemo } from "react";
import { Button, Divider, Checkbox, Slider, Input, Stack, ButtonGroup, Switch, Tooltip, Chip } from "@mui/material";
import { Add, Close, Download } from "@mui/icons-material";
import { FrequencySummary, exportFrequencyAnalysisCSV, addSummariesToData } from "./frequencyAnalysisUtils";
import { Summary } from "./Summary";

function getButtonStyle(selected){
    const result = {
        color: 'black',
        width: '5rem',
        height: '2rem',
        ":hover": {backgroundColor: '#dddddd'}
    }

    if (selected){
        result.backgroundColor = 'primary.green';
        result.color = 'white';
        result[":hover"] = {backgroundColor: 'primary.green'};
    }

    return result;
}

const FrequencyAnalysis = (props) => {
    const {
        data, alignments = [], references = [], soloSelection, seqColumns, selectedColumns, updateSelectedColumns, filter, compact,
        setRowSelection, colours
    } = props;
    
    // Handle ProteinMPNN case where original sequence may not have explicit reference.
    const fixupReferences = references.map((r, col) => r.map((s, row) => s || alignments[col][row]));

    const flatAlignments = (alignments[0] || []).map((_, i) => alignments.map((seqs) => seqs[i]).join('|')),
          flatReferences = (fixupReferences[0] || []).map((_, i) => fixupReferences.map((seqs) => seqs[i]).join('|'));

    const refSequence = flatReferences[0],
          refError = flatReferences.some((r) => r !== refSequence);

    const _sequenceIndex = flatAlignments.indexOf(refSequence);
    const sequenceIndex = Math.max(0, _sequenceIndex);
    const [chainIndex, setChainIndex] = useState(0);

    const availableChains = (!data['structure_chains'])
    ?
        alignments.map((_, ind) => String.fromCharCode(65 + ind))
    :
        data['structure_chains'][sequenceIndex]
    
    const sequences = useMemo(
        () => alignments[chainIndex] || [],
        [alignments, chainIndex]
    );

    const numbering = useMemo(
        () => sequences?.residueNumbers ?? [],
        [sequences]
    );

    const displaySequence = (sequences ?? [])[sequenceIndex] ?? '';
        
    /// =======================================
    /// ============== filtering ==============
    /// =======================================

    const [mutationFilter, setMutationFilter] = useState([]);

    const addMutationFilter = (mutationString) => {
        const newMutationFilter = [...mutationFilter, mutationString.slice(1)];
        setMutationFilter(newMutationFilter);
    }

    const removeMutationFilter = (index) => {
        const newMutationFilter = [...mutationFilter];
        newMutationFilter.splice(index, 1);
        setMutationFilter(newMutationFilter);
    }
    
    // apply all filters to sequence alignment data
    const filtered_sequences = useMemo(
        () => {
            let result = sequences;

            if (filter) {
                result = result.filter((_, index) => filter.has(index));
            }

            mutationFilter.forEach((mutationString) => {
                const pos_absolute = numbering.indexOf(mutationString.slice(0, -1));
                const res = mutationString.slice(-1);

                result = result.filter((seq) => (seq[pos_absolute] === res));
            });

            return result;
        },
        [sequences, mutationFilter, filter, numbering]
    );

    useEffect(() => {
        const selection = [];

        filtered_sequences.forEach((seq, i) => {
            selection.push(sequences.indexOf(seq, selection[(i > 0) ? i-1: 0]));
        });

        if (selection.length === sequences.length) {
            setRowSelection(new Set([0]))
        } else {
            setRowSelection(new Set(selection));
        }
    }, [sequences, filtered_sequences])

    /// =======================================
    /// ============== selection ==============
    /// =======================================

    const [selectionMode, setSelectionMode] = useState('cutoff');
    const [isSelectionExclusive, setIsSelectionExclusive] = useState(false);

    const selectedPositions = useMemo(
        () => {
            if (!selectedColumns) return [];
            if (!selectedColumns[chainIndex]) return [];
            return Array.from(selectedColumns[chainIndex]);
        },  
    [selectedColumns, chainIndex]);
    
    const deselectPositions = () => {
        updateSelectedColumns(seqColumns[chainIndex].column, {op: 'set', column: new Set([])});
    }

    const toggleSelectedPosition = (pos) => {
        updateSelectedColumns(seqColumns[chainIndex].column, {op: 'toggle', column: pos});
    }

    const positionClick = (pos) => {
        if (selectionMode === 'single') {
            if (isSelectionExclusive) {
                updateSelectedColumns(seqColumns[chainIndex].column, {op: 'set', column: new Set([pos])});
            } else {
                toggleSelectedPosition(pos);
            }
        }
        else if (selectionMode === 'multiple') {
            toggleSelectedPosition(pos);
        }
    }

    const changeSelectionMode = (mode) => {
        if (selectionMode === 'cutoff' && mode !== 'cutoff') deselectPositions();
        setSelectionMode(mode)
    }

    /// ======================================
    /// ================ DATA ================
    /// ======================================

    const [frequencyAnalysisData, setFrequencyAnalysisData] = useState({});
    const [previewSummaries, setPreviewSummaries] = useState([]);

    // update frequency data
    useEffect(() => {
        const newFrequencyData = {...frequencyAnalysisData};
        if (!newFrequencyData[chainIndex]){ 
            newFrequencyData[chainIndex] = [];

            for (let i = 0; i < displaySequence.length; i++) {
                const summary = new FrequencySummary(filtered_sequences, [i], numbering, displaySequence, sequenceIndex);
                summary.visible = false;
                newFrequencyData[chainIndex].push(summary);
            }
        }

        setFrequencyAnalysisData(newFrequencyData);
    }, [filtered_sequences, chainIndex, numbering, sequenceIndex]);

    // update preview summaries
    useEffect(() => {
        if (selectedPositions.length === 0) {
            setPreviewSummaries([]);
            return;
        }

        const summaries = [];
        if (selectionMode==='single' || selectionMode==='cutoff') {
            selectedPositions.forEach((pos) => {
                summaries.push(new FrequencySummary(filtered_sequences, [pos], numbering, displaySequence, sequenceIndex))
            })
        }
        else if (selectionMode==='multiple') {
            summaries.push(new FrequencySummary(filtered_sequences, selectedPositions, numbering, displaySequence, sequenceIndex));
        }

        setPreviewSummaries(summaries);
    }, [selectedPositions, filtered_sequences, numbering, displaySequence, selectionMode, sequenceIndex])

    const addSummaryToData = () => {
        const newFrequencyData = addSummariesToData(frequencyAnalysisData, previewSummaries, chainIndex);

        setFrequencyAnalysisData(newFrequencyData);
    }

    const removeSummaryFromData = (index) => {
        const newFrequencyData = {...frequencyAnalysisData};
        newFrequencyData[chainIndex][index].visible = false;

        setFrequencyAnalysisData(newFrequencyData);
    }

    /// =====================================================
    /// ========== REFERENCE SEQUENCE HIGHLIGHTING ==========
    /// =====================================================

    const [highlightRS, setHighlightRS] = useState(false);

    const toggleHighlightRS = () => {
        setHighlightRS(!highlightRS);
    }

    /// ===================================================
    /// ================ FREQUENCY CUTOFFS ================
    /// ===================================================

    const [frequencyCutoff, setFrequencyCutoff] = useState(90);
    const [cutoffMode, setCutoffMode] = useState('% mutated');

    const switchCutoffMode = () => {
        if (cutoffMode==='% non-mutated') setCutoffMode('% mutated');
        else if (cutoffMode==='% mutated') setCutoffMode('% non-mutated');
    }

    const hasNonWTCutoff = (summary, cutoff) => {
        let result = false;

        summary.frequencies.forEach((freq) => {
            if (freq.residue !== summary.reference && freq.frequency >= cutoff/100) result = true
        })

        return result;
    }

    // update selected positions when the frequency cutoff changes in the cutoff selection mode
    useEffect(() => {
        if (!frequencyAnalysisData[chainIndex]) return;
        if (selectionMode !== 'cutoff') return;

        const selectedIndices = [];

        if (cutoffMode === '% non-mutated') {
            frequencyAnalysisData[chainIndex].forEach((summary, index) => {
                if (
                    summary.frequencies.length > 0 &&
                    summary.frequencies[0].residue === summary.reference &&
                    summary.frequencies[0].frequency >= frequencyCutoff/100
                ) {
                    selectedIndices.push(index);
                }
            })
        } else {
            frequencyAnalysisData[chainIndex].forEach((summary, index) => {
                if (hasNonWTCutoff(summary, frequencyCutoff)) {
                    selectedIndices.push(index);
                }
            })
        }

        updateSelectedColumns(seqColumns[chainIndex].column, {op: 'set', column: new Set([])});
        selectedIndices.forEach((ind) => {
            updateSelectedColumns(seqColumns[chainIndex].column, {op: 'toggle', column: ind});
        })
    }, [frequencyCutoff, frequencyAnalysisData, chainIndex, selectionMode, cutoffMode, seqColumns, updateSelectedColumns])
    
    if (refError) {
        return (
            <div>Frequency analysis not available because references do not match</div>
        );
    } else if (references.length > 0 && _sequenceIndex < 0) {
        return (
            <div>Frequency analysis not available because no entry matches the reference.</div>
        );
    }

    return (
        <Stack direction='column' gap='1rem' alignItems={'center'}>
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                <Button
                    onClick={toggleHighlightRS}
                >
                    <Checkbox
                        checked={highlightRS}
                    />
                    Highlight reference sequence
                </Button>
                <Tooltip 
                    title="Download data to .csv"
                    placement='bottom'
                >
                    <Button
                        onClick={
                            () => exportFrequencyAnalysisCSV(
                                frequencyAnalysisData, previewSummaries, numbering, availableChains, chainIndex
                            )
                        }
                    >
                        <Download/>
                    </Button>
                </Tooltip>
            </div>

            <Stack directiom="vertical" gap='0.5rem' sx={{userSelect: 'none', width: '100%'}}>
                <Stack direction="row" gap='1rem' alignItems='center'>
                    Selection Mode
                    <Button
                        onClick={deselectPositions}
                        sx={{
                            color: 'black',
                            width: '7rem',
                            height: '1.5rem',
                            fontSize: '0.75rem',
                            border: '1px solid',
                            borderColor: '#999999',
                            ":hover": {backgroundColor: '#dddddd'}
                        }}
                    >
                        Clear selection
                    </Button>
                </Stack>
                <div 
                    style={{
                        display: 'flex',
                        flexDirection: compact ? 'column' : 'row',
                        width: '100%',
                        gap: '3rem'
                    }}
                >
                    <ButtonGroup>
                        <Tooltip
                            title={`single-residue mutations`}
                            placement='bottom'
                        >
                            <Button
                                onClick={() => changeSelectionMode('single')}
                                sx={getButtonStyle(selectionMode === 'single')}
                            >
                                Single
                            </Button>
                        </Tooltip>
                        <Tooltip
                            title={`multi-residue comutations`}
                            placement='bottom'
                        >
                            <Button
                                onClick={() => changeSelectionMode('multiple')}
                                sx={getButtonStyle(selectionMode === 'multiple')}
                            >
                                Multiple
                            </Button>
                        </Tooltip>
                        <Tooltip
                            title={`mutations by frequency cutoff`}
                            placement='bottom'
                        >
                            <Button
                                onClick={() => changeSelectionMode('cutoff')}
                                sx={getButtonStyle(selectionMode === 'cutoff')}
                            >
                                Cutoff
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                    { (selectionMode==='single') &&
                        <div 
                            style={{
                                display:'flex',
                                justifyContent:'space-between',
                                alignItems: 'center',
                                width: '10rem',
                                userSelect: 'none'
                            }}
                        >
                            {isSelectionExclusive ? 'exclusive' : 'non-exclusive'}
                            <Switch onChange={() => setIsSelectionExclusive(!isSelectionExclusive)}></Switch>
                        </div>
                    }
                    { (selectionMode==='cutoff') &&
                        <Stack
                            gap='5px'
                            direction='row'
                            flexGrow='100'
                            alignItems={'center'}
                            justifyContent={'space-between'}
                        >
                            <Slider
                                value={frequencyCutoff}
                                onChange={(ev) => setFrequencyCutoff(ev.target.value)}
                                valueLabelDisplay="auto"
                                sx={{color: 'primary.blue', width: '70%'}}
                            />
                            <Input
                                value={frequencyCutoff}
                                onChange={(ev) => setFrequencyCutoff(ev.target.value)}
                                inputProps={{
                                    step: 1,
                                    min: 0,
                                    max: 100,
                                    type: 'number',
                                }}
                                style={{maxWidth: '4rem'}}
                            />
                            <div 
                                style={{
                                    display:'flex',
                                    justifyContent:'space-between',
                                    alignItems: 'center',
                                    width: '6rem',
                                    userSelect: 'none'
                                }}
                            >
                                {cutoffMode}
                                <Switch onChange={switchCutoffMode}></Switch>
                            </div>
                        </Stack>
                    }
                </div>
            </Stack>

            <div style={{display: 'flex', flexDirection: 'row', gap: '1rem'}}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', alignItems: 'center'}}>
                    <div style={{fontSize: '18px', fontWeight: '500', paddingBottom: '0.2rem'}}>
                        Chain
                    </div>
                    {
                        availableChains.map((chain, index) => (
                            <Button
                                key={index}
                                sx={{
                                    maxWidth: '30px',
                                    minWidth: '30px',
                                    maxHeight: '30px',
                                    minHeight: '30px',
                                    backgroundColor: (chainIndex === index) ? 'primary.green' : 'white',
                                    color: (chainIndex === index) ? 'white' : 'black',
                                    ':hover': {backgroundColor: (chainIndex === index) ? 'primary.green' : '#dddddd'}
                                }}
                                onClick={() => setChainIndex(index)}
                            >
                                {chain}
                            </Button>
                        ))
                    }
                </div>
                <div>
                    <div 
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'baseline',
                            gap: '10px',
                            fontSize: '18px',
                            fontWeight: '500',
                            paddingBottom: '0.2rem'
                        }}
                    >
                        Sequence
                        <div
                            style={{
                                userSelect: 'none',
                                fontSize: '12px',
                                color: '#777777'
                            }}
                        >
                            ({filtered_sequences ? filtered_sequences.length : sequences.length} sequences)
                        </div>
                        {
                            (mutationFilter.length === 0 && previewSummaries.length > 0)
                            ?
                                <Chip
                                    label={'click on a mutation to filter sequences'}
                                    sx={{
                                        fontSize: '10px',
                                        maxHeight: '24px',
                                        minHeight: '24px'
                                    }}
                                />
                            :
                                mutationFilter.map((mutationString, index) => {
                                    return (
                                        <Chip
                                            key={index}
                                            label={mutationString}
                                            onDelete={() => removeMutationFilter(index)}
                                            sx={{
                                                fontSize: '12px',
                                                maxHeight: '24px',
                                                minHeight: '24px'
                                            }}
                                        />
                                    )
                                })
                        }
                    </div>
                    <div
                        style={{display: 'flex', flexDirection: 'row', flexWrap: 'wrap'}}
                    >
                        {displaySequence.split('').map((letter, index) => (
                            <div
                                key={index}
                                style={{display: 'flex', flexDirection: 'column'}}
                            >
                                <Button
                                    style={{
                                        maxWidth: '20px',
                                        minWidth: '20px',
                                        maxHeight: '20px',
                                        minHeight: '20px',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    {(index % 5 === 0) ? numbering[index] : '.'}
                                </Button>
                                <Button 
                                    sx={{
                                        maxWidth: '20px',
                                        minWidth: '20px',
                                        maxHeight: '20px',
                                        minHeight: '20px',
                                        backgroundColor: (selectedPositions.includes(index)) ? 'primary.blue' : 'white',
                                        color: (selectedPositions.includes(index)) ? 'white' : 'black',
                                        ':hover': (selectedPositions.includes(index)) ? {backgroundColor: 'primary.darkBlue'} : {backgroundColor: '#dddddd'}
                                    }}
                                    onClick={() => positionClick(index)}
                                >
                                    {letter}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {(previewSummaries.length > 0) ?
                <div 
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '5px',
                        width: '100%',
                    }}
                >
                    <Button 
                        onClick={() => {
                            addSummaryToData();
                            deselectPositions();
                        }}
                        sx={{
                            border: '1px solid',
                            borderColor: '#b4cfdb',
                            maxWidth: '40px',
                            minWidth: '40px',
                            maxHeight: '40px',
                            minHeight: '40px',
                            borderRadius: '20px',
                            transition: "background-color 0s",
                            ':hover': {
                                backgroundColor: '#b4cfdb',
                            }
                        }}
                    >
                        <Add/>
                    </Button>
                    <Summary
                        summaries={previewSummaries}
                        numbering={numbering}
                        displaySequence={displaySequence}
                        highlightRS={highlightRS}
                        colours={colours}
                        addMutationFilter={addMutationFilter}
                    />
                </div> 
                :
                <div
                    style={{
                        textAlign: 'center',
                        color: '#888888',
                        fontSize: '12px',
                        cursor: 'default'
                    }}
                >
                    Click on a residue to preview its mutations
                </div>
            }
            
            { !!frequencyAnalysisData[chainIndex] ? 
                <div style={{display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%'}}>
                    { (frequencyAnalysisData[chainIndex].length > 0) ?
                        <Divider 
                            role="presentation"
                            sx={{borderBottomWidth: '2px'}}
                        />
                        : null
                    }
                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                        {frequencyAnalysisData[chainIndex].map((summary, summaryIndex) => {
                            if (!summary) return null;
                            if (!summary.visible) return null;

                            return (
                                <div key={summaryIndex} style={{display: 'flex', flexDirection: 'row'}}>
                                    <Button 
                                        onClick={() => removeSummaryFromData(summaryIndex)}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: '#b4cfdb',
                                            maxWidth: '20px',
                                            minWidth: '20px',
                                            maxHeight: '20px',
                                            minHeight: '20px',
                                            borderRadius: '10px',
                                            transition: "background-color 0s",
                                            ':hover': {
                                                backgroundColor: '#b4cfdb',
                                            }
                                        }}
                                    >
                                        <Close style={{fontSize: '12px'}}/>
                                    </Button>
                                    <Summary
                                        key={summaryIndex}
                                        summaries={[summary]}
                                        numbering={numbering}
                                        displaySequence={displaySequence}
                                        highlightRS={highlightRS}
                                        colours={colours}
                                        addMutationFilter={addMutationFilter}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
                : null
            }
        </Stack>
    )
}

export default FrequencyAnalysis;
