import React, {useCallback, useState} from 'react';

import CellularCol from './CellularCol';

function stars(n) {
    n = parseInt(n);
    if (Number.isNaN(n)) n = 0;
    const filled = Math.max(0, Math.min(5, n)),
          open = 5 - filled;

    const stars = [];
    for (let i = 0; i < filled; ++i) stars.push('\u2605');
    for (let i = 0; i < open; ++i) stars.push('\u2606');
    return stars.join('');
}

function RatingCell({data, index, update, selection, isSelected, updateSelection}) {
    const [highlightState, setHighlight] = useState(undefined);
    const highlight = isSelected ? highlightState : undefined;

    const inHandler = useCallback((ev) => {
        if (ev.target.dataset) {
            setHighlight(parseInt(ev.target.dataset.stars))
        } else {
            setHighlight(data);
        }
    }, [data]);

    const outHandler = useCallback((ev) => {
        setHighlight(undefined);
    });

    const clickHandler = useCallback((ev) => {
        ev.stopPropagation(); ev.preventDefault();

        if (isSelected) {
            if (highlight !== undefined) {
                update(selection ? selection : index, highlight)
            }
        } else {
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
        }
    }, [highlight, update, index, selection, updateSelection, isSelected]);

    const starNum = highlight !== undefined ? highlight : data;
    return (
        <div style={{
                                marginTop: 'auto',
                                marginBottom: 'auto',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                padding: 3,
                                verticalAlign: 'middle'
                          }}
                    onMouseEnter={inHandler} 
                    onMouseLeave={outHandler}
                    onClick={clickHandler} >
            <div style={{display: 'inline-block'}} data-stars="0" onMouseEnter={inHandler}>&nbsp;</div>
            <div style={{display: 'inline-block', color: highlight === undefined ? 'black' : 'orange'}} data-stars="1" onMouseEnter={inHandler}>{starNum >= 1 ? '\u2605' : '\u2606'}</div>
            <div style={{display: 'inline-block', color: highlight === undefined ? 'black' : 'orange'}} data-stars="2" onMouseEnter={inHandler}>{starNum >= 2 ? '\u2605' : '\u2606'}</div>
            <div style={{display: 'inline-block', color: highlight === undefined ? 'black' : 'orange'}} data-stars="3" onMouseEnter={inHandler}>{starNum >= 3 ? '\u2605' : '\u2606'}</div>
            <div style={{display: 'inline-block', color: highlight === undefined ? 'black' : 'orange'}} data-stars="4" onMouseEnter={inHandler}>{starNum >= 4 ? '\u2605' : '\u2606'}</div>
            <div style={{display: 'inline-block', color: highlight === undefined ? 'black' : 'orange'}} data-stars="5" onMouseEnter={inHandler}>{starNum >= 5 ? '\u2605' : '\u2606'}</div>
        </div>
    );
}

export default function RatingCol(props) {
    return (
        <CellularCol CellComponent={RatingCell}
                     {...props} />
    );
}