import { Link, Typography } from "@mui/material";

export function Copyright() {
    return (
      <Typography variant="body2" color="text.secondary" my={1} align="center">
        {'Copyright © '}
        <Link color="inherit" href="https://docs.slimevr.dev/">
          SlimeVR
        </Link>{' '}
        {new Date().getFullYear()}
        {'. Made with love by '}
        <Link color="inherit" href="https://github.com/Futurabeast/">
          Futurabeast
        </Link>
      </Typography>
    );
}
  