import React, { Component } from 'react'
import { Box, Button } from "@mui/material";
import Grid from "@mui/material/Grid";
import TextField from '@mui/material/TextField';

export default class UploadSeqfile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      dataset: null,
      error: null
    };

  }
    render() {
      return (
        <Grid container justifyContent="center"> 
        <Button
        variant="contained"
        component="label"
        color="primary"
      >
        Upload File (csv)
        <input
          type="file"
          hidden
        />
        </Button>    
        <Box 
        component="form"
        sx={{
          '& .MuiTextField-root': { m: 0, width: '30ch' },
        }}
        noValidate
        autoComplete="off"
      >  
          
        <TextField
            id="outlined-multiline-flexible"
            label="Enter H-chain column"
            variant = 'outlined'
            multiline
            maxRows={2}

          />   
           <TextField
            id="outlined-multiline-flexible"
            variant = 'outlined'
            label="Enter L-chain column"
            color='primary'
            multiline
            maxRows={2}
          />                  
         </Box>  
         <Button variant="contained" color="primary" onClick={() => { console.log('Click'); }}>
                Submit
        </Button> 

      </Grid> 
 
      )}}