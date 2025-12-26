import React, {useCallback, useMemo} from 'react';
import {CircularProgress, Tooltip} from '@mui/material';

import CellularCol from './CellularCol';

function StatusCell({data, index, updateSelection, format}) {
    const clickHandler = useCallback((ev) => {
        ev.preventDefault(); ev.stopPropagation();

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
    }, [updateSelection, index]);


    let handler = data?.onClick;
    let message = data?.message;
    let content;
    let status = data?.status ?? data;

    if (status === true) {
        content =<span style={{color: 'green'}}>{ '\u2713' }</span>;
    } else if (status === false) {
        content = (
            <CircularProgress size={8} />
        );
    } else if (status) {
        if (typeof(data) === 'string') {
            message = data;
        } else {
            message = data.message;
        }
        content = <span style={{color: 'red'}}>{ '\u2717' }</span>;
    }

        
    if (handler) {
        content = (
            <a href="#" 
               onClick={(ev) => {ev.preventDefault(); ev.stopPropagation(); handler()}}
               style={{textDecoration: 'none'}}>
                {content}
            </a>
        )
    }
    if (message) {
        content = (
            <Tooltip title={'' + message}>
                {content}
            </Tooltip>
        );
    }

    return (
        <div 
            style={{
                marginTop: 'auto',
                marginBottom: 'auto',
                whiteSpace: 'nowrap',
                width: '100%',
                padding: 3,
                userSelect: 'none'
            }}
            onClick={handler ? undefined : clickHandler}
        >
            { content }
        </div>
    );
}

export default function StatusCol(props) {
    return (
        <CellularCol CellComponent={StatusCell}
                     {...props} />
    );
}
