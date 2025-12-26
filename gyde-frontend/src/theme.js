import { createTheme }
from '@mui/material/styles';

const gtheme = createTheme({
	palette: {
		primary: {
			light: '#a7b9c4',
			main: '#788994',
			dark: '#4c5c66',
			text: '#000000',
			darkBlue: '#153452',
			blue: '#4f9de8',
			lightBlue: '#8abff2',
			green: '#a1c48f',
			lightGreen: '#bcd9ad'
	    },
	    secondary: {
	      light: '#598acb',
	      main: '#1e5d9a',
	      dark: '#00346b',
	      contrastText: '#ffffff'
	    }
	}
});

export default gtheme;
