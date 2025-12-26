import {csvFormatRows} from 'd3-dsv';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate.js';
import { saveAs } from 'file-saver';

import { 
    min, max, normalizeArrayByMax, addScalarToArray, multiplyScalarWithArray, reshapeArray
} from "../utils/math";

export const RESIDUES = [
    "R", "K", "D", "E", "N", "Q", "H", "P", "Y", "W",
    "S", "T", "G", "A", "M", "C", "F", "L", "V", "I"
];

export const RESIDUES_ALPHABETICAL = [
    'A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 
    'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y'
]

export class HeatmapData {
    n_wide = 0;
    n_high = 0;
    offset_array = [];
    value_array = [];
    num_points = 0;
    referenceSequenceIndices = [];
    minVal = 0;
    maxVal = 0;

    parseAlignmentData(alignment, dataColumn, filter, dataScale, relativeToWT, explicitReference, totalize) {
        let filtered_alignment = this.alignment = alignment,
            filtered_data = dataColumn;
        if (! (filtered_data instanceof Array)) {
            filtered_data = [];
            for (let i = 0; i < alignment.length; ++i) filtered_data[i] = dataColumn;
        }
        if (filter) {
            filtered_alignment = alignment.filter((_, index) => filter.has(index));
            filtered_data = filtered_data.filter((_, index) => filter.has(index));
        }

        // get offset array for GL program
        this.n_wide = (filtered_alignment[0]?.seq ?? '').length;
        this.n_high = 20;
        this.offset_array = fillOffsetArray(this.n_wide, this.n_high);

        // get value array for displaying data to users
        this.value_array = getHeatmapData(filtered_alignment, filtered_data, totalize);
        this.num_points = this.value_array.length;

        this.highlight_array_gl = this.value_array.map((_) => 0);

        this.referenceSequenceIndices = getReferenceSequenceIndices(filtered_alignment, filtered_data);

        if (relativeToWT) {
            // scale array such that the WT value is set to 1
            const valWT = dataColumn[explicitReference || 0];
            this.value_array_scaled = multiplyScalarWithArray(this.value_array, 1.0/valWT);

            // apply log scale to array, WT value will be set to 0
            this.value_array_scaled = applyDataScale(this.value_array_scaled, dataScale);
            this.maxVal = max(this.value_array_scaled);
            this.minVal = min(this.value_array_scaled);
        }  else {
            // apply data scale to array
            this.value_array_scaled = applyDataScale(this.value_array, dataScale);
            this.maxVal = max(this.value_array);
            this.minVal = min(this.value_array);
        }
    }

    parseMatrixData(matrix, seqStart, seqLength, alignment) {
        this.alignment = alignment;  // Stash alignment for click-handling.

        // get offset array for GL program 
        this.n_wide = seqLength;
        this.n_high = 20;
        this.offset_array = fillOffsetArray(this.n_wide, this.n_high);

        this.value_array = []; 
        for (let i = 0; i < seqLength; i++) {
            for (let j = 0; j < 20; j++) {
                const res = RESIDUES[j];
                const res_index = RESIDUES_ALPHABETICAL.indexOf(res);
                this.value_array.push(matrix ? (matrix[i + seqStart] || [])[res_index] : null);
            }
        }
        this.num_points = this.value_array.length;

        this.value_array_scaled = this.value_array;
        this.maxVal = max(this.value_array);
        this.minVal = min(this.value_array);
    }

    normalizeData(minVal, maxVal, dataScale, relativeToWT) {
        this.minVal = minVal; this.maxVal = maxVal;

        if (relativeToWT) {
            // find min and max values of the log-scaled data
            const minScaled = minVal;
            const absMinScaled = Math.abs(minScaled);
            const maxScaled = maxVal;

            // find which has the highest magnitude
            const mag = Math.max(Math.abs(minScaled), Math.abs(maxScaled));

            // translate values in array to be above 0, with WT value set to mag
            this.value_array_norm = addScalarToArray(this.value_array_scaled, mag);
    
            // scale down to the range [0, 1] and set WT value to 0.5
            this.value_array_norm = multiplyScalarWithArray(this.value_array_norm, 0.5/mag);

            this.minScaled = (minScaled + mag) * 0.5/mag;
            this.maxScaled = (maxScaled + mag) * 0.5/mag;
        } else {
            let  tmp = [minVal, maxVal];
            tmp = applyDataScale(tmp, dataScale);
            // subtract min. value such that the min. of the array is 0
            const [minScaled, maxScaled] = tmp;
            this.value_array_scaled = addScalarToArray(this.value_array_scaled, -minScaled);
    
            // scale down to [0, 1] by dividing by the max. value
            this.value_array_norm = multiplyScalarWithArray(this.value_array_scaled, 1.0/(maxScaled-minScaled));

            this.minScaled = 0;
            this.maxScaled = 1;
        }

        // remove null values for GLSL program
        this.value_array_gl = nullToNegative(this.value_array_norm);
        // reshape normalized array for molstar structure coloring
        this.normalized_value_matrix = reshapeArray(this.value_array_norm, this.n_wide, this.n_high);
    }

    findEntriesWithResidue(column, row) {
        const diff = RESIDUES[row];

        const firstSequence = this.alignment[0].seq;
        const seqLen = firstSequence.length;

        const entries = new Set();

        for (let i = 0; i < this.alignment.length; ++i) {
            const refSequence = this.alignment[i].germLine || firstSequence || '';
            if (this.alignment[i].seq && this.alignment[i].seq[column] === diff) {
                entries.add(i);
            }
        }

        return entries;
    }

    getSwizzledOffsetArray(columnSwizzle, n_high=20) {
        const tot_wide = this.value_array ? (this.value_array.length / n_high) : 0;
        const invertSwizzle = new Array(tot_wide);
        columnSwizzle.forEach((s, i) => {invertSwizzle[s] = i});

        const result = [];

        for (let i = 0; i < invertSwizzle.length; ++i) {
            for (let j = 0; j < n_high; ++j) {
                let ii = invertSwizzle[i];
                if (typeof(ii) !== 'number') ii = -100;
                result.push(ii, n_high - j - 1);
            }
        }
        return result;
    }

    updateHighlightedCells(stagedMutations) {
        if (!stagedMutations) return;

        this.highlight_array_gl = new Array(this.num_points).fill(0);

        stagedMutations.forEach((mutant) => {
            const {x, y} = mutant;
            this.highlight_array_gl[20*x + y] = 1;
        })
    }
}

export function fillOffsetArray(n_wide, n_high) {
    const result = [];

    for (let i = 0; i < n_wide; i++) {
        for (let j = 0; j < n_high; j++) {
            result.push(i, n_high - j - 1);
        }
    }

    return result;
}

/// column_name: points to a column in the data with numerical values
export function getHeatmapData(sequence_data, data_column, totalize) {
    const num_sequences = sequence_data.length;
    
    const first_sequence = sequence_data[0]?.seq ?? '';
    const seq_len = first_sequence.length;
    
    const result = []; 
    for (let i = 0; i < 20*seq_len; i++) 
    {
        result.push(totalize ? 0 : null);
    }

    if (num_sequences < 1 || !data_column) return result;

    // Identity positions where at least one non-reference sequence has a difference, so we can
    // then fill in reference sequence data exclusively for these positions.
    const positions_with_diffs = new Set();
    for (let i = 0; i < num_sequences; i++) {
        let reference_sequence = sequence_data[i].germLine;
        if (!reference_sequence) reference_sequence = first_sequence

        for (let j = 0; j < seq_len; j++) {
            const current_residue = sequence_data[i].seq[j];
            const reference_residue = reference_sequence[j];

            if (current_residue !== reference_residue && !!data_column[i]) {
                positions_with_diffs.add(j);
            }
        }
    }

    for (let i = 0; i < num_sequences; i++) {
        let reference_sequence = sequence_data[i].germLine;
        if (!reference_sequence) reference_sequence = first_sequence

        for (let j = 0; j < seq_len; j++) {
            if (!positions_with_diffs.has(j)) continue;

            const current_residue = sequence_data[i].seq[j];
            const reference_residue = reference_sequence[j];

            if (current_residue !== reference_residue || sequence_data[i].seq === reference_sequence) {
                const val = data_column[i];
                const residue_index = RESIDUES.indexOf(current_residue);

                if (val && typeof val === 'number') {
                    if (totalize) {
                        result[20*j + residue_index] += val;
                    } else {
                        result[20*j + residue_index] = val;
                    }
                }
            }
        }
    }

    return result;
}

function getReferenceSequenceIndices(sequenceData, dataColumn) {
    let refSeq = null;
    const firstSequence = sequenceData[0]?.seq || '';
    
    if (!dataColumn) return [];

    for (let i = 0; i < sequenceData.length; ++i) {
        const itemRef = sequenceData[i].germLine ?? firstSequence;
        if (refSeq !== null && refSeq !== itemRef) return;  // Not an unambiguous reference.            
        
        refSeq = itemRef;
    }

    const positions_with_diffs = new Set();
    for (let i = 0; i < sequenceData.length; i++) {
        for (let j = 0; j < refSeq.length; j++) {
            const current_residue = sequenceData[i].seq[j];
            const reference_residue = refSeq[j];

            if (current_residue !== reference_residue && !!dataColumn[i]) {
                positions_with_diffs.add(j);
            }
        }
    }

    return (refSeq || '').split('').map((c) => RESIDUES.indexOf(c)).map((c, i) => positions_with_diffs.has(i) ? c : -10);
}

// array: number[n]
// returns: number[n]
export function applyDataScale(array, dataScale) {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        if (!!array[i] && (dataScale === 'logarithmic' || dataScale === 'fold change')) {
            result.push(Math.log2(array[i]))
        }
        else if (!!array[i] && (dataScale === '-logarithmic' || dataScale === '-fold change')) {
            result.push(-Math.log2(array[i]))
        }
        else if (!!array[i] && dataScale === '-linear') {
            result.push(-array[i])
        }
        else {
            result.push(array[i])
        }
    }

    return result;
}

export function nullToNegative(array) {
    const result = []

    for (let i = 0; i < array.length; i++) {
        let entry = array[i]

        if (entry == null) {
            entry = -9999;
        }

        result.push(entry);
    }

    return result;
}

export function exportHeatmapCSV(heatmapData, columnName, numbering, chains, exportAllCols, isTransposed) {
    chains.forEach((chain) => {
        const columns = ['Residue'];
        const rows = [];
        const sequenceNumbering = numbering[chain];

        const data = heatmapData[chain].value_array;
        const seqLength = Math.round(data.length / 20);

        const filteredIndices = [];

        for (let i = 0; i < seqLength; i++) {
            if (exportAllCols) {
                filteredIndices.push(i)
            } else {
                let hasData = false;

                for (let j = 0; j < 20; j++) {
                    if (!!data[20*i + j]) hasData = true;
                }
    
                if (hasData) filteredIndices.push(i);
            }
        }

        RESIDUES.forEach((res, i) => {
            const row = [res];

            filteredIndices.forEach((index) => {
                if (!sequenceNumbering[index]) return;
                if (i === 0) columns.push(sequenceNumbering[index]);
                row.push(data[20*index + i])
            })

            rows.push(row)
        })

        let result = [columns].concat(rows);
        
        if (isTransposed) {
            let transposedResult = [];

            for (let i = 0; i < result[0].length; i++) {
                transposedResult.push([]);

                for (let j = 0; j < result.length; j++) {
                    transposedResult[i].push(result[j][i]);
                }
            }

            transposedResult[0][0] = 'Sequence position';
            result = transposedResult;
        }

        const fileBlob = new Blob([csvFormatRows(result)], {type: 'text/csv'});
        saveAs(fileBlob, `${chain}_${columnName}.csv`);
    })
}

export const exportHeatmapXLSL = async (heatmapData, columnName, numbering, chains, exportAllCols, isTransposed) => {
    const workbook = await XlsxPopulate.fromBlankAsync();
    
    chains.forEach((chain) => {
        const sheet = workbook.addSheet(chain);
        const sequenceNumbering = numbering[chain];

        const data = heatmapData[chain].value_array;
        const seqLength = Math.round(data.length / 20);

        // filter data
        const filteredIndices = [];

        for (let i = 0; i < seqLength; i++) {
            if (exportAllCols) {
                filteredIndices.push(i)
            } else {
                let hasData = false;

                for (let j = 0; j < 20; j++) {
                    if (!!data[20*i + j]) hasData = true;
                }
    
                if (hasData) filteredIndices.push(i);
            }
        }

        if (isTransposed) {
            sheet.cell(1,  1).value('Sequence position').style('bold', true);
            
            RESIDUES.forEach((res, i) => {
                sheet.cell(1, i + 2).value(res).style('bold', true);
                let indexGap = 0;
                
                filteredIndices.forEach((index, count) => {
                    if (!sequenceNumbering[index]) {
                        indexGap += 1; 
                        return;
                    }

                    if (i ===0) sheet.cell(count + 2 - indexGap, 1).value(sequenceNumbering[index]).style('bold', true);
                    sheet.cell(count + 2 - indexGap, i + 2).value(data[20*index + i]);
                })
            })
        } else {
            sheet.cell(1,  1).value('Residues').style('bold', true);
            
            RESIDUES.forEach((res, i) => {
                sheet.cell(i + 2, 1).value(res).style('bold', true);
                let indexGap = 0;
                
                filteredIndices.forEach((index, count) => {
                    if (!sequenceNumbering[index]) {
                        indexGap += 1; 
                        return;
                    }

                    if (i ===0) sheet.cell(1, count + 2 - indexGap).value(sequenceNumbering[index]).style('bold', true);
                    sheet.cell(i + 2, count + 2 - indexGap).value(data[20*index + i]);
                })
            })
        }
    });

    workbook.deleteSheet('Sheet1');
    const blob = await workbook.outputAsync('blob');
    saveAs(blob, `${columnName}.xlsx`);
}
