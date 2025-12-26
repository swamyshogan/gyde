import React, { useState, useMemo } from "react";
import { Tooltip } from "@mui/material";
import { getPositionString, getMutationString } from "./frequencyAnalysisUtils";
import { cleanNumberForDisplay } from "../utils/utils";
import { RESIDUES_ALPHABETICAL } from "../utils/constants";

export const Summary = (props) => {
    const {summaries, numbering, displaySequence, highlightRS, addMutationFilter, colours} = props;

    const [hoveredIndices, setHoveredIndices] = useState([null, null]);

    const positionStrings = summaries.map((summary) => getPositionString(summary.positions, numbering, displaySequence));
    const referenceResidues = summaries.map((summary) => summary.positions.reduce((prev, curr) => prev + displaySequence[curr], ''));

    const colorMap = useMemo(() => {
        const result = {};

        RESIDUES_ALPHABETICAL.forEach((res) => {
            if (colours === 'germline') {
                result[res] = '#6eeb71';
            } else if (colours === 'germline-invert') {
                result[res] = '#6eeb71';
            } else if (Object.keys(colours).length === 0) {
                result[res] = '#6eeb71';
            } else {
                result[res] = colours[res];
            }
        })

        result['X'] = '#cccccc';
        return result;
    }, [colours])

    return (
        <div style={{display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem'}}>
            {summaries.map((summary, summaryIndex) => (
                <div 
                    key={summaryIndex} 
                    style={{display: 'flex', flexDirection: 'row', gap: '2px', width: '100%', alignItems: 'center'}}
                >
                    <div style={{minWidth: '100px', maxWidth: '100px', textAlign: 'center', fontWeight: 'bold'}}>
                        {positionStrings[summaryIndex]}
                    </div>
                    
                    { summary.frequencies.length > 0 ?
                        summary.frequencies.map((val, index) => {
                            const res = val.residue;
                            const highlighted = (res === referenceResidues[summaryIndex]) && highlightRS;
                            const hovered = summaryIndex === hoveredIndices[0] && index === hoveredIndices[1];
                            const mutationString = getMutationString(summary.positions, numbering, summary.reference, res);

                            return (
                                <Tooltip
                                    key={index}
                                    title={`${cleanNumberForDisplay(val.frequency * 100, 1)}% ${res}`}
                                    placement='top'
                                    followCursor
                                >
                                    <div
                                        style={{
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            left: val.cumulativeSum,
                                            width: `${val.frequency * 100}%`,
                                            height: '20px',
                                            background: res.length === 1 ? colorMap[res] : '#6eeb71',
                                            color: highlighted ? 'white' : 'black',
                                            opacity: (highlighted || hovered) ? 1 : (1 - Math.pow(1 - val.frequency, 2))*0.6 + 0.2,
                                        }}
                                        onClick={() => addMutationFilter(mutationString)}
                                        onMouseEnter={() => {setHoveredIndices([summaryIndex, index])}}
                                        onMouseLeave={() => {setHoveredIndices([null, null])}}
                                    >
                                        {val.frequency > 0.008 + res.length * 0.008 ? val.residue : null}
                                    </div>
                                </Tooltip>
                            )
                        })
                        : 
                            <div
                                style={{
                                    color: '#555555',
                                    fontSize: '12px',
                                    textAlign: 'center',
                                    flexGrow: 100
                                }}
                            >
                                No data
                            </div>
                    }
                </div>
            ))}
        </div>
    )
}