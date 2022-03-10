import { ThemeProvider } from '@emotion/react';
import { AppBar, createTheme, CssBaseline, Link, Toolbar, Typography } from '@mui/material';
import { RestfulProvider } from 'restful-react';
import { Copyright } from './components/Copyright';
import { FirmwareTool } from './components/firmware-tool/FirmwareTool';

const theme = createTheme();

function Page() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        position="absolute"
        color="default"
        elevation={0}
        sx={{
          position: 'relative',
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" color="inherit" noWrap>
            <Link href='/' underline="none" color="inherit">SlimeVR Firmware Tool</Link>
          </Typography>
        </Toolbar>
      </AppBar>
      <FirmwareTool></FirmwareTool>
      <Copyright></Copyright>
    </ThemeProvider>
  )
}


function App() {
  return (
    <RestfulProvider base={process.env.REACT_APP_API_BASE || ''}>
      <Page></Page>
    </RestfulProvider>
  );
}

export default App;
