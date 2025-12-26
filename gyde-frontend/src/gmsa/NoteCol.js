import React, {useCallback, useState} from 'react';

import CellularCol from './CellularCol';

function NoteCell({data, index, update, selection, updateSelection, isSelected}) {
    const [isEditing, setEditing] = useState(false);
    const [editingText, setEditingText] = useState();

    const clickHandler = useCallback((ev) => {
        ev.preventDefault(); ev.stopPropagation();

        if (!isSelected) {
            if (index !== undefined) {
                if (updateSelection) {
                    updateSelection({
                        op: (ev.ctrlKey || ev.metaKey) 
                        ? 'toggle'
                        : ev.shiftKey
                          ? 'extend'
                          : 'set', 
                        item: parseInt(index)
                    });
                }
            }
        } else {
            setEditing(true);
            setEditingText((data || data === 0) ? data.toString() : '')
        }
    }, [isSelected, updateSelection, index, data]);

    const onEditFinished = useCallback((content) => {
        if (content !== undefined) {
            update(selection ? selection : index, content);
        }
        setEditing(false);
    }, [selection, index]);

    const onKeyPress = useCallback((ev) => {
        if (ev.code === 'Enter') {
            onEditFinished(editingText);
        } else if (ev.code === 'Escape') {
            onEditFinished();
        }
    }, [editingText, onEditFinished]);

    let content = (data || data === 0) ? data.toString() : '';

    if (isEditing) {
        content = (
            <input type="text"
                   value={editingText} 
                   onChange={(ev) => setEditingText(ev.target.value)}
                   onKeyDown={onKeyPress}
                   onBlur={(ev) => {
                       onEditFinished(editingText)
                   }}
                   style={{padding: 0, width: '100%', height: '10px'}}
                   ref={(el) => el?.focus()} />
        )
    }

    return (
        <div style={{
                                marginTop: 'auto',
                                marginBottom: 'auto',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                padding: 3
                          }}
                    onClick={clickHandler} >
            { content }
        </div>
    );
}

export default function NoteCol(props) {

    return (
        <CellularCol CellComponent={NoteCell}
                     {...props} />
    );
}
