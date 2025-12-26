const residue_counts = {
    "A": 0,
    "C": 0,
    "D": 0,
    "E": 0,
    "F": 0,
    "G": 0,
    "H": 0,
    "I": 0,
    "K": 0,
    "L": 0,
    "M": 0,
    "N": 0,
    "P": 0,
    "Q": 0,
    "R": 0,
    "S": 0,
    "T": 0,
    "V": 0,
    "W": 0,
    "Y": 0,
};

const MAX_ENTROPY = Math.log2(20);
const INV_MAX_ENTROPY = 1 / MAX_ENTROPY;

// TODO: all of these functions iterate over the full sequence but they could instead be
// broken down into doing everything position-wise while looping over the full seuqence
// should be accomplished from another function

export function getRelativeFrequencies(sequence_data) {
    const num_sequences = sequence_data.length;
    const inv_num_sequences = 1/num_sequences;
    // sequence length is the same for all sequences in the alignment
    const seq_len = sequence_data[0].seq.length;

    const relative_frequencies = []; 
    
    for (let i = 0; i < seq_len; i++) {
        relative_frequencies.push({...residue_counts});

        for (let j = 0; j < num_sequences; j++) {
            const res = sequence_data[j].seq[i];

            if (res in residue_counts) {
                relative_frequencies[i][res] += inv_num_sequences;
            }
        }
    }

    return relative_frequencies;
}

export function getShannonEntropies(relative_frequencies) {
    const shannon_entropies = []

    for (let i = 0; i < relative_frequencies.length; i++) {
        var entropy = 0;

        for (let res in relative_frequencies[i]) {
            const freq = relative_frequencies[i][res];

            if (freq > 0){
                entropy -= freq * Math.log2(freq) * INV_MAX_ENTROPY;
            }
        }
        
        // rounding
        entropy = parseFloat(entropy.toFixed(6));
        shannon_entropies.push(entropy);
    }

    return shannon_entropies;
}

export function getResidueHeights(sequence_data) {
    const relative_frequencies = getRelativeFrequencies(sequence_data);
    const shannon_entropies = getShannonEntropies(relative_frequencies);

    const residue_heights = []

    for (let i = 0; i < shannon_entropies.length; i++) {
        const height = 1 - shannon_entropies[i];
        const residueHeightAtPosition = {...residue_counts};

        for(let res in residueHeightAtPosition) {
            residueHeightAtPosition[res] = relative_frequencies[i][res] * height;
        }

        residue_heights.push(residueHeightAtPosition);
    }

    return residue_heights;
}

/// residue_heights: array of objects like residue_counts at the start of this file
/// returns Object[][] with residue and height fields
export function filterResidueHeights(residue_heights) {
    const filtered_residues = [];

    for (let i = 0; i < residue_heights.length; i++) {

        const filtered_residues_for_position_i = [];
    
        for (let key in residue_heights[i]) {
            const val = residue_heights[i][key]
            if (val > 0) {
                filtered_residues_for_position_i.push({'residue': key, 'height': val})
            }
        }

        filtered_residues.push(filtered_residues_for_position_i);
    }

    return filtered_residues;
}

// sorted_residues: Object[] with residue and height fields
function getCumulativeSums(sorted_residue_frequencies) {
    var cumulative_sum = 0;

    for (let i = 0; i < sorted_residue_frequencies.length; i++) {
        cumulative_sum += sorted_residue_frequencies[i].height;
        sorted_residue_frequencies[i].cumulative_sum = cumulative_sum;
    }
}

export function getSortedResidueHeights(residue_heights) {
    const filtered_residues = filterResidueHeights(residue_heights);
    
    for (let i = 0; i < filtered_residues.length; i++) {
        const position_array = filtered_residues[i];

        position_array.sort((a, b) => {return (a.height < b.height)? -1 : 1});
        getCumulativeSums(position_array);
    }

    return filtered_residues;
}


export function getSequenceLogoBufferArrays(sorted_residues) {
    const heights = [];
    const offsets = [];
    const charCodes = [];

    for (let i = 0; i < sorted_residues.length; i++) {
        if (sorted_residues[i].length === 0) continue;

        for (let j = 0; j < sorted_residues[i].length; j++) {
            const res = sorted_residues[i][j];
            heights.push(res.height);
            offsets.push(i);
            offsets.push(res.cumulative_sum);
            charCodes.push(res.residue.charCodeAt(0));
        }
    }

    return {heights, offsets, charCodes};
}
