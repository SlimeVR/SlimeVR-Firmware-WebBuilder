import { Accordion, AccordionDetails, AccordionSummary, FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography } from "@mui/material"
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useFirmwareControllerGetBatteriesTypes } from "../../generated-types";
import { Controller } from "react-hook-form";

export function BatteryConfig({ control, errors, batteryType }: { batteryType: string, control: any, errors: any }) {
    const { data: batteries, loading: batteriesLoading } = useFirmwareControllerGetBatteriesTypes({});

    return (
        <Accordion variant='outlined'>
            <AccordionSummary expandIcon={
                <ExpandMoreIcon/>
            }>
            <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom >
                Battery Sense (Optional)
            </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={12}>
                    <FormControl fullWidth>
                        <Controller
                            name={"battery.type"}
                            control={control}
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <>
                                    <InputLabel id="battery-label">Battery Type</InputLabel>
                                    <Select
                                        labelId="battery-label"
                                        label="Battery Type"
                                        value={batteriesLoading ? 'loading' : value || 'none'}
                                        onChange={onChange}
                                        
                                        error={!!errors.battery?.type}
                                    >
                                        {batteriesLoading && <MenuItem value="loading" disabled>Loading</MenuItem>}
                                        <MenuItem value="none" disabled>Please select the battery type</MenuItem>
                                        {!batteriesLoading && batteries && batteries!.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>) }
                                    </Select>
                                </>
                            
                            )}
                            />
                        </FormControl>
                    </Grid>
                    {batteryType === "BAT_EXTERNAL" &&
                    <>
                        <Grid item xs={12} sm={12}>
                            <FormControl fullWidth>
                                <Controller
                                    name={"battery.resistance"}
                                    control={control}
                                    rules={{ required: true, min: 0 }}
                                    render={({ field: { onChange, value },  }) => (
                                        <TextField error={!!errors.battery?.resistance} onChange={onChange} value={value || ''}  label={"Battery shield resistance (kOhm)"} />
                                    )}
                                />
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={12}>
                            <FormControl fullWidth>
                                <Controller
                                    name={"battery.shieldR1"}
                                    control={control}
                                    rules={{ required: true, min: 0 }}
                                    render={({ field: { onChange, value },  }) => (
                                        <TextField error={!!errors.battery?.shieldR1} onChange={onChange} value={value || ''}  label={"Battery shield resistance R1"} />
                                    )}
                                />
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={12}>
                            <FormControl fullWidth>
                                <Controller
                                    name={"battery.shieldR2"}
                                    control={control}
                                    rules={{ required: true, min: 0 }}
                                    render={({ field: { onChange, value },  }) => (
                                        <TextField error={!!errors.battery?.shieldR1} onChange={onChange} value={value || ''}  label={"Battery shield resistance R2"} />
                                    )}
                                />
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={12}>
                            <FormControl fullWidth>
                                <Controller
                                    name={"battery.pin"}
                                    control={control}
                                    rules={{ required: true }}
                                    render={({ field: { onChange, value },  }) => (
                                        <TextField error={!!errors.battery?.pin} onChange={onChange} value={value || ''}  label={"Battery sense PIN"} />
                                    )}
                                />
                            </FormControl>
                        </Grid>
                    </>
                    }
                </Grid>
            </AccordionDetails>
        </Accordion>
    )

}