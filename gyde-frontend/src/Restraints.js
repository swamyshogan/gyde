import React, {useMemo, useCallback, useState} from 'react';
import {
    Table, TableHead, TableBody, TableRow, TableCell, Button, TextField
} from '@mui/material';
import {Hexagon as Molecule} from '@mui/icons-material';


export default function Restraints({
    restraints=[],
    seqColumns=[],
    seqColumnNames=[],
    updateRestraint,
    deleteRestraint
}) {
    const seqColumnToName = useMemo(() => {
        const seqColumnToName = {};
        seqColumns.forEach(({column}, i) => {seqColumnToName[column] = seqColumnNames[i] ?? `Sequence ${i+1}`});
        return seqColumnToName;
    }, [seqColumns, seqColumnNames]);

    const deleteRow = useCallback((ev) => {
        const rid = getRID(ev.target);
        if (!rid) return;
        deleteRestraint(rid);
    }, [deleteRestraint]);

    const updateName = useCallback((ev) => {
        const rid = getRID(ev.target);
        if (!rid) return;
        updateRestraint(rid, {name: ev.target.value})
    }, [updateRestraint]);

    const updateMax = useCallback((ev) => {
        const rid = getRID(ev.target);
        if (!rid) return;
        updateRestraint(rid, {maxAngstroms: ev.value})
    }, [updateRestraint]);

    const updateMin = useCallback((ev) => {
        const rid = getRID(ev.target);
        if (!rid) return;
        updateRestraint(rid, {minAngstroms: ev.value})
    }, [updateRestraint]);

    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell>From sequence</TableCell>
                    <TableCell>From position</TableCell>
                    <TableCell>To sequence</TableCell>
                    <TableCell>To position</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Min [Å]</TableCell>
                    <TableCell>Max [Å]</TableCell>
                    <TableCell>-</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                { restraints.map((r, i) => (
                    <TableRow key={i} data-rid={r?.id}>
                        <TableCell>
                            {r.fromLigand ? <Molecule sx={{verticalAlign: 'middle'}} /> : undefined}
                            {seqColumnToName[r?.fromSeqCol] || r?.fromSeqPos || '-'}
                        </TableCell>
                        <TableCell>
                            {typeof(r?.fromSeqPos) === 'number' ? r?.fromSeqPos + 1 : '-'}
                        </TableCell>
                        <TableCell>
                            {r.toLigand ? <Molecule sx={{verticalAlign: 'middle'}} /> : undefined}
                            {seqColumnToName[r?.toSeqCol] || r.fromSeqCol || '-'}
                        </TableCell>
                        <TableCell>
                            {typeof(r?.toSeqPos) === 'number' ? r?.toSeqPos + 1 : '-'}
                        </TableCell>
                        <TableCell>
                            <TextField variant="standard"
                                       value={r?.name}
                                       onChange={updateName} />
                        </TableCell>
                        <TableCell>
                            <DistanceTextField value={r?.minAngstroms ?? 0}
                                               onChange={updateMin} />
                        </TableCell>
                        <TableCell>
                            <DistanceTextField value={r?.maxAngstroms ?? 0}
                                               onChange={updateMax} />
                        </TableCell>
                        <TableCell>
                            <Button style={{color: 'red'}} onClick={deleteRestraint?.bind(null, r?.id)}>X</Button>
                        </TableCell>
                    </TableRow>
                )) }
            </TableBody>
        </Table>
    );
}

const DistanceTextField = ({value, onChange}) => {
    const [text, setText] = useState(undefined);

    const onTextChange = useCallback((ev) => {
        const t = ev.target.value;
        const tm = /\d*(\.\d*)?/.exec(t)
        const tt = tm[0] || '';
        setText(tt);
        const v = parseFloat(tt);
        if (!Number.isNaN(v)) {
            onChange({target: ev.target, value: v})
        } else if (!tt) {
            onChange({target: ev.target, value: 0})
        }
    }, [onChange]);

    const onBlur = useCallback((ev) => {
        setText(undefined);
    }, []);

    return (
        <TextField variant="standard"
                   value={text ?? value.toString()}
                   onChange={onTextChange}
                   onBlur={onBlur} />
    );
}

function getRID(el) {
    if (el.dataset?.rid) return el.dataset.rid;
    if (el.parentElement) return getRID(el.parentElement);
}