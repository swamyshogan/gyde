import React, {useCallback, useMemo} from 'react';

import CellularCol from './CellularCol';

function sigfig(n, sigfig) {
    if (! (sigfig > 1) /* NB written like this to catch NaN */) sigfig = 1;
    if (sigfig > 100) sigfig = 100;
    return n.toPrecision(sigfig);
}

function InfoCell({data, index, updateSelection, format}) {
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

    const stringified = useMemo(() => {
        if (typeof(data) === 'number' && typeof(format?.sigfig) === 'number') {
            return sigfig(data, format.sigfig);
        } 

        return (data || data === 0) ? data.toString() : ''
    }, [data, format]);

    let content = stringified,
        isLink = false;
    if (/^https?:\/\//.exec(content)) {
        content = (<a target="_blank" href={content}>{content}</a>);
        isLink = true;
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
            onClick={isLink ? undefined : clickHandler}
        >
            { content }
        </div>
    );
}

export default function InfoCol(props) {

    return (
        <CellularCol CellComponent={InfoCell}
                     {...props} />
    );
}
