import { Card, CardContent, Checkbox, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from "@mui/material";
import { useMemo } from "react";
import { Control, Controller } from "react-hook-form";
import { useFirmwareControllerGetIMUSTypes } from "../../generated-types";
import { HelperComponent } from "../HelperComponent";



export function ImuConfig({ forced, control, watch, errors, name, imuIndex }: { imuIndex: number, forced: boolean, watch: any, errors: any,  control: Control<any, any>, name: string }) {

    
    const { data: imus, loading: imusLoading } = useFirmwareControllerGetIMUSTypes({});
    
    const controlPrefix = `imus.${imuIndex}`
    
    const ackyuallyEnabled = forced || watch(`${controlPrefix}.enabled`);
    const type = watch(`${controlPrefix}.type`);

    const currentImu = useMemo(() => imus?.find(({ type: t }) => t === type), [type, imus]);


    return (
      <Card variant="outlined" sx={{ height: '100%' }} >
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            <Controller
              name={`${controlPrefix}.enabled`}
              control={control}
              render={({ field: { onChange, value } }) => (
                <FormControlLabel control={<Checkbox onChange={onChange} checked={value} disabled={forced}/>} label={name} />
              )}
            />
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={12}>
              <FormControl fullWidth>
                <Controller
                  name={`${controlPrefix}.type`}
                  control={control}
                  rules={{ required: ackyuallyEnabled }}
                  render={({ field: { onChange, value } }) => (
                    <>
                      <InputLabel id="imu-label">IMU Type</InputLabel>
                      <Select
                        labelId="imu-label"
                        label="IMU Type"
                        value={imusLoading ? 'loading' : value || 'none'}
                        disabled={!ackyuallyEnabled}
                        onChange={onChange}
                        error={errors.imus && errors.imus[imuIndex] && !!errors.imus[imuIndex].type}
                      >
                        {imusLoading && <MenuItem value="loading" disabled>Loading</MenuItem>}
                        <MenuItem value="none" disabled>Please select the imu type</MenuItem>
                        {!imusLoading && imus && imus!.map((item) => <MenuItem key={item.type} value={item.type}>{item.type}</MenuItem>) }
                      </Select>
                    </>
                  
                  )}
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12}>
              <FormControl fullWidth>
                <Controller
                  name={`${controlPrefix}.rotation`}
                  control={control}
                  rules={{ required: ackyuallyEnabled, min: 0, max: 360 }}
                  render={({ field: { onChange, value },  }) => (
                    <>
                      <TextField error={ackyuallyEnabled && errors.imus && errors.imus[imuIndex] && !!errors.imus[imuIndex].rotation} type="number" disabled={!ackyuallyEnabled} onChange={onChange} value={value}  label={"IMU Roation (DEG)"} />
                      <HelperComponent text="IMU Rotation configuration" link='https://docs.slimevr.dev/firmware/configuring-project.html#adjust-imu-board-rotation' />
                    </>
                  )}
                />
              </FormControl>
            </Grid>
            {currentImu && currentImu?.hasIntPin && <Grid item xs={12} sm={12}>
              <FormControl fullWidth>
                <Controller
                  name={`${controlPrefix}.imuINT`}
                  control={control}
                  rules={{ required: currentImu?.hasIntPin }}
                  render={({ field: { onChange, value },  }) => (
                    <TextField error={currentImu?.hasIntPin && errors.imus && errors.imus[imuIndex] && !!errors.imus[imuIndex].imuINT} disabled={!ackyuallyEnabled} onChange={onChange} value={value || ''}  label={"IMU INT Pin"} />
                  )}
                />
              </FormControl>
            </Grid>}
          </Grid>
        </CardContent>
      </Card>
    )
}