import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router" 
import { Tooltip, TextField } from "@mui/material";
import { CloudUpload, CloudDone, CloudOff } from '@mui/icons-material';

const EditableTabTitle = ({name, updateTabProps}) => {
    const [editing, setEditing] = useState(false);
    const [content, setContent] = useState(name);

    const onDoubleClick = useCallback((ev) => {
        setEditing(true);
    }, [setEditing]);

    const onFieldChange = useCallback((ev) => {
        setContent(ev.target.value);
    }, [setContent]);

    const onKeyPress = useCallback((ev) => {
        if (ev.code === 'Enter') {
            setEditing(false);
            updateTabProps({name: content});
        }
    }, [setEditing, updateTabProps, content]);

    const onBlur = useCallback((ev) => {
        setEditing(false);
        updateTabProps({name: content});
    }, [setEditing, updateTabProps, content]);

    if (editing) {
        return (
            <TextField 
                autoFocus
                value={content}
                onChange={onFieldChange} 
                onKeyPress={onKeyPress}
                onBlur={onBlur}
                sx={{input: {color: '#ffffff'}}}
            />
        );

    } else {
        return (
            <div style={{display: 'inline-block'}}
                 onDoubleClick={onDoubleClick}>
                {name || '...'}
            </div>
        )
    }
}

const TabLabel = (props) => {
    const { tab, savingErrors, savingTab, tabLastTransition, tabLastSave } = props;
    const navigate = useNavigate();

    const close = useCallback((ev) => {
        ev.stopPropagation(); ev.preventDefault();
        
        const nextURL = tab.closeTab();
        navigate(nextURL);
    }, [tab, navigate])

    return (
        <Link to={`/dataset/${tab._external_id}`} style={{whiteSpace: 'nowrap'}}>
            <div style={{
                display: 'inline-block',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'elipsis',
                verticalAlign: 'middle',
                color: 'white'
            }}>
                <EditableTabTitle
                    name={tab.name}
                    updateTabProps={tab.updateTabProps}
                />
                { tab._gyde_readonly
                    ? <Tooltip title="Read-only session, saving not possible">
                        <CloudOff style={{verticalAlign: 'middle', paddingLeft: '0.5em'}} />
                    </Tooltip>
                    : savingErrors[tab.id]
                        ? <Tooltip title={savingErrors[tab.id].err}>
                            <CloudOff style={{
                                verticalAlign: 'middle',
                                paddingLeft: '0.5em',
                                color: savingErrors[tab.id]?.count > 2 ? 'red' : undefined
                            }}/>
                            </Tooltip>
                        : savingTab[tab.id]
                            ? <CloudUpload  style={{verticalAlign: 'middle', paddingLeft: '0.5em'}} />
                            : (tabLastTransition[tab.id] || 0) <= (tabLastSave[tab.id] || 0) 
                                ? <Tooltip title="Tab contents saved, check 'sessions' to retrieve">
                                    <CloudDone style={{verticalAlign: 'middle', paddingLeft: '0.5em'}} />
                                </Tooltip>
                                : undefined 
                }
            </div>
            <Tooltip title="Close this tab">
                <div 
                    onClick={ close }
                    style={{
                        display: 'inline-block',
                        minWidth: '20px',
                        marginLeft: '10px',
                        color: '#aaaaaa'
                    }}
                >
                    X
                </div>
            </Tooltip>
        </Link> 
    )
}

export default TabLabel;
