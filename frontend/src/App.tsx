import { ThemeProvider } from '@emotion/react';
import { AppBar, Button, createTheme, CssBaseline, Link, Toolbar, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { RestfulProvider } from 'restful-react';
import { Copyright } from './components/Copyright';
import { FirmwareTool } from './components/firmware-tool/FirmwareTool';

function Page() {
  const localTheme = localStorage.getItem("user-theme");
  const systemDarkMode = matchMedia("(prefers-color-scheme: dark)");

  const [prefersDarkMode, setPrefersDarkMode] = useState(
    localTheme ? localTheme === "dark" : systemDarkMode.matches,
  );
  if (!localTheme) {
    systemDarkMode.onchange = (ev) => {
      !localStorage.getItem("user-theme") &&
        setPrefersDarkMode(() => ev.matches);
    };
  }

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? "dark" : "light",
        },
      }),
    [prefersDarkMode],
  );

  const toggleTheme = async () => {
    setPrefersDarkMode((value) => {
      const newValue = !value;
      localStorage.setItem("user-theme", newValue ? "dark" : "light");
      return newValue;
    });
  };

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
          <Typography variant="h6" color="inherit" noWrap sx={{ flexGrow: 1 }}>
            <Link href='/' underline="none" color="inherit">SlimeVR Firmware Tool</Link>
          </Typography>
          <Button variant="outlined" onClick={toggleTheme}>
            {prefersDarkMode ? "Dark" : "Light"}
          </Button>
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
