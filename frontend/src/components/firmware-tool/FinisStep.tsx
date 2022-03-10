import { Box, Button, Card, CardContent, Grid, Typography } from "@mui/material";

export function FinishStep({ doAnother, toConfig }: { doAnother: () => void, toConfig: () => void }) {
    return (
      <Card variant='outlined'>
        <CardContent>
          <Box sx={{ width: '100%' }}>
            <Typography mb={2} variant="h5" color="inherit" textAlign="center" noWrap>
              Firmware Uploaded. Your tracker is set up!
            </Typography>
            <Grid container spacing={2}  justifyContent="center">
              <Grid item xs={12} sm={4}>
                <Button fullWidth variant="contained" onClick={doAnother}>Flash another one</Button>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button fullWidth onClick={toConfig}>Go to config</Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    )
  }