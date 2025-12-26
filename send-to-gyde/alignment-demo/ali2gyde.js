const REF_SEQ = 'MDVGPSSLPHLGLKLLLLLLLLPLRGQANTGCYGIPGMPGLPGAPGKDGYDGLPGPKGEPGIPAIPGIRGPKGQKGEPGLPGHPGKNGPMGPPGMPGVPGPMGIPGEPGEEGRYKQKFQSVFTVTRQTHQPPAPNSLIRFNAVLTNPQGDYDTSTGKFTCKVPGLYYFVYHASHTANLCVLLYRSGVKVVTFCGHTSKTNQVNSGGVLLRLQVGEEVWLAVNDYYDMVGIQGSDSVFSGFLLFPD';
const REF_NAME = 'P02747'

function* parseCigar(cigar) {
    const rex = /(\d+)?([MID])/y;
    while (true) {
        const match = rex.exec(cigar);
        if (!match) return;

        yield {op: match[2], count: match[1] ? parseInt(match[1]) : 1}
    }
}

function swizzleSequence(seq, cigar, queryMin, queryMax, min, max, queryLength) {
    let queryCursor = queryMin - 1,
        modelCursor = min - 1;

    const ali = [];

    for (const {op, count} of parseCigar(cigar)) {
        for (let i = 0; i < count; ++i) {
            if (op === 'M') {
                while (ali.length < queryCursor) ali.push('-');
                ali.push(seq[modelCursor]);

                ++modelCursor; ++queryCursor;
            } else if (op === 'I') {
                ++modelCursor;
            } else if (op === 'D') {
                ++queryCursor;
            }
        }
    }
    while (ali.length < queryLength) ali.push('-');
    return ali.join('');
}

async function prepare() {
    const response = await fetch('pdb-P02747.json');
    const featureData = await response.json();

    const data = [
        {
            seqid: 'ref',
            concept_name: REF_NAME,
            seed: REF_NAME,
            sequence: REF_SEQ,
            gyst_alignment: REF_SEQ,
            perc_identity: 100
        }, ...featureData.data.features.map((feature, index) => ({
            seqid: feature.model,
            concept_name: feature.model_protein_name,
            seed: REF_NAME,
            sequence: feature.sequence,
            gyst_alignment: swizzleSequence(feature.sequence, feature.cigar, feature.min, feature.max, feature.model_min, feature.model_max, REF_SEQ.length),
            perc_identity: feature.perc_identity,
            structure_url: feature.structure_url
        }))
    ];

    const gydeSession = {
        name: 'Structures for P02747',
        alignmentKey: 'alignedSeqs',
        isAntibody: false,
        data,
        dataColumns: ['seqid', 'concept_name', 'seed', 'sequence', 'gyst_alignment', 'perc_identity', 'structure_url'],
        seqColumns: ['sequence'],
        seqColumnNames: ['Sequence'],
        msaColumns: [
            {
                column: 'gyst_alignment',
                numbering: REF_SEQ.split('').map((_, i) => `${i+1}`)
            }
        ]
    }

    document.querySelector('#form').addEventListener('formdata', (ev) => {
      const fd = ev.formData;
      fd.append(
        'session_data',
        new Blob([JSON.stringify(gydeSession)],
          {'type': 'application/json'})
      );
    });

    document.querySelector('#send_button').disabled = false;
}

prepare();