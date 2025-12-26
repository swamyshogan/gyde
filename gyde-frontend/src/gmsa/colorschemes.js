import colors from 'msa-colorschemes';

const MSA_COLORS = [
    {
        name: 'Lesk',
        colours: colors.getScheme('lesk')
    },
    {
        name: 'Clustal',
        colours: colors.getScheme('clustal')
    },
    {
        name: 'Clustal2',
        colours: colors.getScheme('clustal2')
    },
    {
        name: 'Mae',
        colours: colors.getScheme('mae')
    },
    {
        name: 'Taylor',
        colours: colors.getScheme('taylor')
    },
    {
        name: 'Hydrophobicity',
        colours: colors.getScheme('hydro')
    },
    {
        name: 'Plain',
        colours: {},
    },
    {
        name: 'Diffs. to master seq.',
        colours: 'germline'
    },
    {
        name: 'Diffs. to master seq. (invert)',
        colours: 'germline-invert'
    }
];

export default MSA_COLORS;