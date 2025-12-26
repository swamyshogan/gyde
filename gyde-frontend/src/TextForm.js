import React, { Component } from 'react'
import TextField from '@mui/material/TextField';
import { Box } from '@mui/material';
import Button from '@mui/material/Button';
import Grid from "@mui/material/Grid";


export default class TextForm extends Component {
  render() {
    return (
        <Grid container justifyContent="center"> 
        <Box 
        component="form"
        sx={{
          '& .MuiTextField-root': { m: 0, width: '40ch' },
        }}
        noValidate
        autoComplete="off"
      >    
       <div>            
          <TextField
            id="outlined-multiline-flexible"
            label="Paste H-chain sequence(s)"
            variant = 'outlined'
            multiline
            maxRows={Infinity}
          />
          <br></br><br></br>
           <TextField
            id="outlined-multiline-flexible"
            variant = 'outlined'
            label="Paste L-chain sequence(s)(preserve order)"
            placeholder="Placeholder"
            color='primary'
            multiline
            maxRows={Infinity}
          />
          </div>
          <br></br><br></br>       
        <Button variant="contained" color="primary" onClick={() => { console.log('Click'); }}>
                Submit
        </Button>    
      </Box>
      </Grid>
    )
  }
}




