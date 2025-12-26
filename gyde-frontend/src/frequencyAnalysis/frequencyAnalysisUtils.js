import {csvFormatRows} from 'd3-dsv';
import { saveAs } from 'file-saver';

export class FrequencySummary {
    frequencies = [];
    visible = true;
    positions = [];
    name = '';
    reference = '';

    constructor(sequences, positions, numbering, displaySequence, referenceIndex) {
        this.positions = [...positions];
        this.name = getPositionString(positions, numbering, displaySequence);
        this.reference = positions.reduce((prev, curr) => {return prev + displaySequence[curr]}, '');
        this.referenceIndex = referenceIndex

        this.update(sequences, positions)
    }

    update(sequences, positions) {
        const frequencies = frequenciesAtPositions(sequences, positions, this.referenceIndex);
        this.frequencies = Object.entries(frequencies).map(
            (entry, index) => { return {residue: entry[0], frequency: entry[1]}}
        ).sort(
            (a, b) => a.frequency > b.frequency ? -1 : 1
        );
    
        let sum = 0
        for (let i = 0; i < this.frequencies.length; i++) {
            this.frequencies[i].cumulativeSum = sum;
            sum += this.frequencies[i].frequency;
        }
    }
}

export function frequenciesAtPositions(sequences, positions, referenceIndex) {
    const result = {};
    const numSequences = sequences.length;

    if (numSequences === 0) return result;
    const frac = 1/(numSequences - ((referenceIndex < numSequences && referenceIndex >= 0) ? 1 : 0));

    for (let i = 0; i < numSequences; i++) {
        if (i === referenceIndex) continue;
        const resPair = positions.reduce((prev, curr) => {return prev + sequences[i][curr]}, '');

        if (resPair){
            if (!result[resPair]) result[resPair] = 0;
            result[resPair] += frac;
        }
    }
    
    return result;
}

export function getBarePositionString(positions, numbering) {
    let result = '';

    positions.forEach((pos, index) => {
        if (index !== 0) result += '-';
        result += `${numbering[pos]}`;
    });

    return result;
}

export function getPositionString(positions, numbering, sequence) {
    let result = '';

    positions.forEach((pos, index) => {
        if (index !== 0) result += '-';
        result += `${numbering[pos]}${sequence[pos]}`;
    });

    return result;
}

export function getMutationString(positions, numbering, reference_residues, residues) {
    let result = '';

    positions.forEach((pos, index) => {
        if (index !== 0) result += '-';
        result += `${reference_residues[index]}${numbering[pos]}${residues[index]}`;
    });

    return result;
}

export function addSummariesToData(frequencyData, summaries, chainIndex) {
    if (summaries.length === 0) return;

    const newFrequencyData = {...frequencyData};
    if (!newFrequencyData[chainIndex]) newFrequencyData[chainIndex] = [];

    summaries.forEach((summary) => {
        const collisionIndex = newFrequencyData[chainIndex].findIndex((s) => s.name === summary.name);

        if (collisionIndex > -1) {
            newFrequencyData[chainIndex][collisionIndex].visible = true;
        } else {
            newFrequencyData[chainIndex].push(summary);
        }
    })

    return newFrequencyData;
}

export function exportFrequencyAnalysisCSV(frequencyAnalysisData, previewSummaries, numbering, availableChains, chainIndex) {
    const columns = ['chain', 'position', 'reference_residue'];
    const rows = [];
    const newFrequencyData = addSummariesToData(frequencyAnalysisData, previewSummaries, chainIndex);

    Object.keys(newFrequencyData).forEach((key) => {
        newFrequencyData[key].forEach((summary) => {
            const row = [];
            const numSummaries = summary.frequencies.length;

            if (summary.visible) {
                const posString = getBarePositionString(summary.positions, numbering)
                row.push(availableChains[key], posString, summary.reference);

                for (let i = 0; i < numSummaries; i++) {
                    const mutationString = getMutationString(
                        summary.positions, numbering, summary.reference, summary.frequencies[i].residue
                    );
                    row.push(mutationString);
                    row.push(summary.frequencies[i].residue);
                    row.push(summary.frequencies[i].frequency);

                    if ((columns.length - 3)/3 < i + 1) {
                        columns.push(`mutation_${i + 1}`);
                        columns.push(`residue_${i + 1}`);
                        columns.push(`frequency_${i + 1}`);
                    }
                }

                rows.push(row);
            }
        })
    })
    
    const result = [columns].concat(rows);
    const fileBlob = new Blob([csvFormatRows(result)], {type: 'text/csv'});
    saveAs(fileBlob, 'frequencyAnalysis.csv');
}
