import { parsePDB } from 'molstar/lib/mol-io/reader/pdb/parser';
import { parseCifText } from 'molstar/lib/mol-io/reader/cif/text/parser';
import { pdbToMmCif } from 'molstar/lib/mol-model-formats/structure/pdb/to-cif';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { Structure } from 'molstar/lib/mol-model/structure';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';

export function renumberPdb(pdbString, targetChain) {
	const lines = pdbString.split('\n');
	const renumberedLines = [];
	let lastResNum = '';
	let lastChain = '';
	let n = -1;
	const mapping = {};

	for (const line of lines) {
		let newLine = line;

		if (line.startsWith('ATOM ')) {
			const chain = line.substring(21, 22);
			const resNum = line.substring(22, 27);

			if (chain !== lastChain) {
				lastChain = chain;
				n = -1;
			}
			if (resNum !== lastResNum) {
				lastResNum = resNum;
				n++;
				if (chain === targetChain) {
					mapping[n] = resNum.trim();
				}
			}

			if (chain === targetChain) {
				const nString = n.toString();
	
				let newPdbSubstring = resNum;
				if (nString.length <= 4) {
					newPdbSubstring = nString + ' ';
					const fac = 4 - nString.length;
	
					if (fac > 0) {
						for (let i = 0; i < fac; i++) {
							newPdbSubstring = ' ' + newPdbSubstring;
						}
					}
				}
	
				newLine = line.substring(0, 22) + newPdbSubstring + line.substring(27);
			}
		}

		renumberedLines.push(newLine)
	}

	return {renumberedData: renumberedLines.join('\n'), mapping: mapping};
}

async function readStructure(pdbEntry, format) {
	if (format === 'mmcif') {
		const task = parseCifText(pdbEntry);
		const cifParsed = await task.run();
		return cifParsed.result.blocks[0];
	} else {
		const task = parsePDB(pdbEntry, '----', false);
		const pdbParsed = await task.run();
		const cifParsed = await pdbToMmCif(pdbParsed.result);
		return cifParsed;
	}
}

export async function pdbToMmCifText(name, pdbText) {
	const pdbParsed = await parsePDB(pdbText, name, false).run();
	const cifParsed = await pdbToMmCif(pdbParsed.result);
	const models = await trajectoryFromMmCIF(cifParsed).run();
	const struct = Structure.ofModel(models.representative);
	return to_mmCIF(name, struct);
}

export async function getPdbChains(pdbEntry, format='pdb') {
	const cifParsed = await readStructure(pdbEntry, format);

	const atoms = cifParsed.categories.atom_site;
	const auth_asym = atoms.getField('auth_asym_id').toStringArray(),
	      auth_seq = atoms.getField('auth_seq_id').toStringArray(),
	      ins_code = atoms.getField('pdbx_PDB_ins_code').toStringArray(),
	      residues = atoms.getField('auth_comp_id').toStringArray(),
	      type = atoms.getField('group_PDB').toStringArray();


	const len = auth_seq.length;
	const residuesByChain = {};
	for (let i = 0; i < len; ++i) {
		if (type[i] !== 'ATOM') continue;

		const chain = auth_asym[i],
		      resid = auth_seq[i] + ins_code[i],
		      res = residues[i];

		let rl = residuesByChain[chain];
		if (!rl) {
			residuesByChain[chain] = rl = [];
		}
		const last = rl[rl.length - 1];
		if (last?.resid !== resid) {
			rl.push({resid, res});
		}
	}

	const result = {};
	for (const [chain, residues] of Object.entries(residuesByChain)) {
		const [rawAtomicSequence, rawNumbering] = chainSequence(residues),
		      [mpnnAtomicSequence, mpnnNumbering] = chainSequenceMPNN(residues);

		result[chain] = {
			rawAtomicSequence,
			rawNumbering,
			mpnnAtomicSequence,
			mpnnNumbering
		};
	}
	return result;
}


function chainSequence(residues) {
	const seq = [],
	      numbering = [];
	for (const {resid, res} of residues) {
		seq.push(AA3_TO_AA1[res] || 'X');
		numbering.push(resid);
	}
	return [seq.join(''), numbering];
}

function chainSequenceMPNN(residues) {
	let lastResNum;

	const seq = [],
	      numbering = [];
	for (const {resid, res} of residues) {
		const resNum = parseInt(resid);
		if (typeof(lastResNum) === 'number') {
			for (let i = lastResNum; i < resNum - 1; ++i) {
				numbering.push('');
				seq.push('X');
			}
		}

		seq.push(AA3_TO_AA1[res] || 'X');
		numbering.push(resid);
		lastResNum = resNum
	}
	return [seq.join(''), numbering];
}

const AA3_TO_AA1 = {
	'ALA': 'A',
	'CYS': 'C',
	'ASP': 'D',
	'GLU': 'E',
	'PHE': 'F',
	'GLY': 'G',
	'HIS': 'H',
	'ILE': 'I',
	'LYS': 'K',
	'LEU': 'L',
	'MET': 'M',
	'ASN': 'N',
	'PRO': 'P',
	'GLN': 'Q',
	'ARG': 'R',
	'SER': 'S',
	'THR': 'T',
	'VAL': 'V',
	'TRP': 'W',
	'TYR': 'Y',
	'SEC': 'U',
	'PYL': 'O'
}