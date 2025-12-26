import React, {useState} from "react";
import {
    Button, Dialog, DialogTitle, DialogContent, IconButton,
    DialogActions, TextField, Typography, Stack, TableContainer,
    TableHead, TableBody, Table, TableRow, TableCell,
} from "@mui/material";
import { Close, Upload } from "@mui/icons-material";

import {readAsText} from '../utils/loaders';

export const PdbUploadButton = (props) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <React.Fragment>
            <Button
                onClick={() => setIsDialogOpen(true)}
                sx={props.style}
            >
                Attach structure
                <Upload sx={{fontSize: props.compact ? '16px' : 'auto'}}/>
            </Button>
            <PdbUploadDialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                {...props}
            />
        </React.Fragment>
    )
}

export const PdbUploadDialog = ({open, onClose, columnarData, selection, addValueToNewStructureColumn,
                                 structureKeys=[], setVisibleStructures}) => {
    const [structureDataBlob, setStructureDataBlob] = useState(null);
    const [structureName, setStructureName] = useState('');
    const [fileName, setFileName] = useState('');
    
    const reset = () => {
        setStructureDataBlob(null);
        setFileName('');
    }

    const onHide = () => {
        reset();
        onClose();
    }

    const validateStructureName = (col) => {
        if (columnarData[col]) {
            if (structureKeys.indexOf(col) < 0) {
                return 'Column exists but is not a structure column';
            } else if (Array.from(selection || []).some((index) => !!((columnarData[col] || [])[index]))) {
                return 'A structure of this name already exists for at least some selected items';
            }
            return;
        } else {
            return;
        }
    };

    const uploadStructure = async (ev) => {
        const file = ev.target.files[0];

        if (! (file instanceof Blob)) {
            return;
        }

        if (file.name && (file.name.endsWith('.pdb') || file.name.endsWith('.cif'))) {
            const structData = await readAsText(file);
            const structDataBlob = new Blob([structData], {type: file.name.endsWith('cif') ? 'chemical/x-mmcif' : 'chemical/x-pdb'});


            let _fileName = file.name;
            const dotIndex = _fileName.lastIndexOf('.');
            if (dotIndex > 0) {
                _fileName = _fileName.substring(0, dotIndex);
            }

            let column_name;
            
            // arbitrarily set 50 as the max amount of user-uploaded structures
            for (let i = 1; i <= 50; i++) {
                const col = `uploaded_structure_${i}`;
                if (!validateStructureName(col)) {
                    column_name = col;
                    break;
                }
            }
            
            setFileName(file.name);
            setStructureDataBlob(structDataBlob);
            setStructureName(column_name);
        } else {
            return;
        }
    }

    const submitStructure = () => {
        selection.forEach((index) => {
            if (structureDataBlob && structureName) {
                addValueToNewStructureColumn(index, structureDataBlob, structureName);
                setVisibleStructures([structureName]);
            }
        })
    }

    const nameValidity = validateStructureName(structureName);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="upload-structure-dialog-title"
        >
            <DialogTitle id="upload-structure-dialog-title">
                Upload Structure
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                    }}
                >
                    <Close/>
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    width: '40rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '40px',
                }}
            >
                <input 
                    id="upload-structure"
                    type="file"
                    accept="chemical/x-pdb, .pdb, chemical/x-cif, chemical/x-mmcif, .cif"
                    value={''}
                    onChange={uploadStructure}
                    style={{display: 'none'}}
                />
                <Stack direction='row' spacing='10px' sx={{alignItems: 'center'}}>
                    <label htmlFor="upload-structure">
                        <Button variant="contained" component="span"> Select file</Button>
                    </label>
                    <Typography>{fileName}</Typography>
                </Stack>

                {(!!structureDataBlob)
                    ? <Stack direction="column">
                        <Typography variant='h6'>Import Options</Typography>
                        <TextField
                            sx={{width: '85%'}}
                            label='Structure Name'
                            value={structureName}
                            margin="normal"
                            error={!!nameValidity}
                            helperText={nameValidity}
                            onChange={(ev) => {
                                setStructureName(ev.target.value);
                            }}
                          />
                      </Stack>
                    : null
                }
            </DialogContent>

            <DialogActions>
                <Button 
                    onClick={() => {submitStructure(); onHide()}}
                    disabled={!structureDataBlob || nameValidity}
                >
                    Submit
                </Button>
                <Button onClick={onHide}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    )
}