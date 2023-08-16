import { Accordion, AccordionDetails, AccordionSummary, Button, Checkbox, FormControl, FormControlLabel, Grid, InputLabel, MenuItem,  Select,  TextField, Typography } from '@mui/material';
import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { BuildResponse, useFirmwareControllerGetBoardsTypes, useFirmwareControllerGetDefaultConfig, useFirmwareControllerGetIMUSTypes, useFirmwareControllerGetVersions } from '../../generated-types';
import { Controller } from 'react-hook-form';
import { useSerial } from '../../hooks/serial';
import { ImuConfig } from './ImuConfig';
import { BatteryConfig } from './BatteryConfig';
import { WifiConfig } from './WifiConfig';


export function ConfigurationForm({ form, nextStep }: { form: any, nextStep: (id: BuildResponse) => void }) {
    const { serialSupported } = useSerial();
    const { handleSubmit, formState, control, watch, reset } = form;
  
    const version = watch("version");
    const wifi = watch("wifi");
    const batteryType = watch("battery.type");
    const enableLed = watch("board.enableLed");

  
    const { errors } = formState;
    const { data: releases, loading: releasesLoading  } = useFirmwareControllerGetVersions({});
  
    const { data: boards, loading: boardsLoading } = useFirmwareControllerGetBoardsTypes({});

    const { data: imus, loading: imusLoading } = useFirmwareControllerGetIMUSTypes({});
  
    const { refetch } = useFirmwareControllerGetDefaultConfig({
      board: '',
      lazy: true,
    });
  

    const onBoardChange = (event: any) => {
      const boardType = event.target.value;

      if (boardType) {
        refetch({ pathParams: { board: boardType } }).then((data) => {
          if (!data) return;
          const build = data as any;

          build.version = version;
          build.wifi = wifi;
          
          reset(build)
        })
      }
    }

    // useEffect(() => {
    
    // // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [boardType])
  
  
    const onSubmit = (data: any) => {
      data.imus = data.imus
        .filter(({ enabled }: { enabled: boolean }) => !!enabled)
        .map(({ enabled, ...imu }: any) => ({ ...imu }));
      nextStep(data);
    };
  
    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
                { <Controller
                    name={"version"}
                    control={control}
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <>
                        <InputLabel id="version-label">Firmware Version</InputLabel>
                        <Select
                          labelId="version-label"
                          label="Firmware Version"
                          value={releasesLoading ? 'loading' : (value || 'none')}
                          error={!!errors.version}
                          onChange={onChange }
                        >
                          {releasesLoading && <MenuItem value="loading" disabled>Loading</MenuItem>}
                          <MenuItem value="none" disabled>Please select the firmware version</MenuItem>
                          {!releasesLoading && releases && releases!.map((item) => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>) }
                        </Select>
                      </>
                    
                    )}
                  />
                  }
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth>
              <Controller
                name={"board.type"}
                control={control}
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <InputLabel id="board-label">Board</InputLabel>
                    <Select
                      labelId="board-label"
                      label="Board"
                      value={boardsLoading ? 'loading' : (value || 'none')}
                      onChange={(event) => { 
                        onBoardChange(event) 
                        onChange(event) 
                      }}
                      error={!!errors.board?.type}
                    >
                      {boardsLoading && <MenuItem value="loading" disabled>Loading</MenuItem>}
                      <MenuItem value="none" disabled>Please select the board</MenuItem>
                      {!boardsLoading && boards && boards!.map((board) => <MenuItem key={board.boardType} value={board.boardType}>{board.boardType}</MenuItem>) }
                    </Select>
                  </>
                
                )}
              />
            </FormControl>
            <Accordion variant='outlined'>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
              >
                <Typography>Advanced options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <Controller
                        name={"board.pins.imuSDA"}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <TextField onChange={onChange} value={value || ''} label={"SDA Pin"} />
                        )}
                      />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <Controller
                        name={"board.pins.imuSCL"}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <TextField onChange={onChange} value={value || ''} label={"SCL Pin"} />
                        )}
                      />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <Controller
                        name={"board.enableLed"}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <FormControlLabel control={<Checkbox onChange={onChange} checked={value} />} label="Enable LED" />
                        )}
                      />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <Controller
                        name={"board.pins.led"}
                        control={control}
                        render={({ field: { onChange, value } }) => (
                          <TextField onChange={onChange} value={value || ''} disabled={!enableLed}  label={"Led pin"} />
                        )}
                      />
                    </FormControl>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
            <Grid item xs={12} sm={12} mt={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <ImuConfig watch={watch} control={control} imuIndex={0} errors={errors} name={'Primary IMU'} forced imus={imus} imusLoading={imusLoading}></ImuConfig>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <ImuConfig watch={watch} control={control} imuIndex={1} errors={errors} name={'Secondary IMU'} forced={false} imus={imus} imusLoading={imusLoading}></ImuConfig>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} sm={12}>
            <BatteryConfig batteryType={batteryType} control={control} errors={errors} ></BatteryConfig>
          </Grid>
          <Grid item xs={12} sm={12}>
            <WifiConfig errors={errors} control={control}></WifiConfig>
          </Grid>
          <Grid item xs={12} sm={12}>
            <Button
              variant="contained"
              type="submit"
              disabled={!serialSupported}
            >
              Continue
            </Button>
          </Grid>
        </Grid>
      </form>
    )
}
  