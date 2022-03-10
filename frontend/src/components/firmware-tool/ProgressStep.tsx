import { Box, Button, Card, CardContent, Grid, LinearProgress, Typography } from "@mui/material";
import { useState } from "react";


export function ProgressStep({ value, message, showRickOption }: { value: number | null, message: string, showRickOption: boolean }) {

  const [rick, showRick] = useState(false);

  const turnOnRick = () => {
    showRick(true)

  }

    return (
      <Card variant='outlined'>
        <CardContent>
          <Box sx={{ width: '100%' }}>
            <Typography mb={2} variant="h5" color="inherit" textAlign="center" noWrap>
              {message}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <LinearProgress variant={value === null ? 'indeterminate' : 'determinate'} value={value || 0} />  
              </Grid>
              {showRickOption && 
              <Grid item xs={12}>
                <Grid container justifyContent="center"  alignContent="center" flexDirection="column">
                    <Grid item>
                      {!rick && <Button fullWidth onClick={turnOnRick}>Some Good music while you wait</Button>}
                    </Grid>
                    <Grid item xs={12} style={{ height: 600, width: '100%' }}>
                      {rick &&
                        <iframe height="600" width="100%" src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                      }
                    </Grid>
                </Grid>
              </Grid>}
            </Grid>
          </Box>
        </CardContent>
      </Card>
    )
  }