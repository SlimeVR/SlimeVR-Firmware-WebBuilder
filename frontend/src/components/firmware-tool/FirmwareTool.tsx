import { Alert, Container, Link, Paper, Step, StepContent, StepLabel, Stepper, Typography } from "@mui/material";
import { ConfigurationForm } from "./ConfigrationForm";
import { ErrorPane } from "./ErrorPane";
import { FinishStep } from "./FinisStep";
import { ProgressStep } from "./ProgressStep";
import { useSerial } from "../../hooks/serial";
import { useFirmwareTool } from "../../hooks/firmware-tool";


const steps = ['Configuration', 'Building', 'Downloading', 'Flashing', 'Done'];


export function FirmwareTool() {

    const { serialSupported } = useSerial();
    const { flash, activeStep, error, buildConfig, form, statusValue, statusMessage, toConfig } = useFirmwareTool();


    const doAnother = () => {
      flash()
    }
  
    return (
        <Container component="main" maxWidth="md" sx={{ my: 3 }}>
            {!serialSupported && 
                <Alert variant="filled" severity="error" sx={{ my: 2 }}>
                    This Browser does not support the WebSerial API.
                    <p>Please use a different browser. (Chrome, Microsoft Edge or Opera)</p>
                </Alert>
            }
            <Alert variant="outlined" severity="info" sx={{ my: 2 }}>
                SlimeVR/vX.X.X - SlimeVR stable release(s)
                <p><Link href="https://github.com/SlimeVR/SlimeVR-Tracker-ESP/tree/main">SlimeVR/main</Link> - SlimeVR development branch</p>
                <p><Link href="https://github.com/deiteris/SlimeVR-Tracker-ESP/tree/qmc-mag-new">deiteris/qmc-mag-new</Link> - For use with the MPU6050/MPU6500 + QMC5883L external magnetometer configuration</p>
                <p><Link href="https://github.com/deiteris/SlimeVR-Tracker-ESP/tree/hmc-mag">deiteris/hmc-mag</Link> - For use with the MPU6050/MPU6500 + HMC5883L external magnetometer configuration</p>
                <p><Link href="https://github.com/TheBug233/SlimeVR-Tracker-ESP-For-Kitkat/tree/qmc-axis-aligned-en">TheBug233/qmc-axis-aligned-en</Link> - Forked from "deiteris/qmc-mag-new", but XYZ axis aligned</p>
                <p><Link href="https://github.com/Lupinixx/SlimeVR-Tracker-ESP/tree/mpu6050-fifo">Lupinixx/mpu6050-fifo</Link> - Attempts to use a FIFO + VQF filter for the imu</p>
                <p><Link href="https://github.com/0forks/SlimeVR-Tracker-ESP-BMI160/tree/v3dev">0forks/v3dev</Link> - Adds packet bundling, related to the SlimeVR beta "<Link href="https://discord.com/channels/817184208525983775/1101075492213358642/1101075492213358642">Improved TPS stability</Link>"</p>
                <p><Link href="https://github.com/0forks/SlimeVR-Tracker-ESP-BMI160/tree/v3dev-bmm">0forks/v3dev-bmm</Link> - Improves support for the BMI160 and adds support for the BMM150</p>
                <p><Link href="https://github.com/unlogisch04/SlimeVR-Tracker-ESP/tree/feat_commitid">unlogisch04/feat_commitid</Link> - Testing adding git commit ID info</p>
                <p><Link href="https://github.com/ButterscotchV/SlimeVR-Tracker-ESP/tree/mag-enabled-stable">ButterscotchV/mag-enabled-stable</Link> - The latest stable firmware release with 9 DoF ICM-20948 and BNO0xx (magnetometer enabled)</p>
                <p><Link href="https://github.com/ButterscotchV/SlimeVR-Tracker-ESP/tree/mag-enabled-main">ButterscotchV/mag-enabled-main</Link> - Based off SlimeVR/main with 9 DoF ICM-20948 and BNO0xx (magnetometer enabled)</p>
                <p><Link href="https://github.com/nekomona/SlimeVR-Tracker-ESP/tree/unify-fusion">nekomona/unify-fusion</Link> - Unifying sensor fusion code</p>
                <p><Link href="https://github.com/l0ud/SlimeVR-Tracker-ESP-BMI270/tree/main">l0ud/main</Link> - Adds support for the BMI270 and includes ESP32-C3 fixes</p>
            </Alert>
            <Alert variant="filled" severity="warning" sx={{ my: 2 }}>
                IMPORTANT NOTICE: The IMU Rotation option has changed, please be aware that the values used before may need to be modified to function properly (90 deg and 270 deg have been swapped, so it should now follow SlimeVR's documentation).
            </Alert>
            <Paper variant="outlined" sx={{ my: { xs: 3, md: 3 }, p: { xs: 1, md: 3 } }}>
                <Typography component="h1" variant="h4" align="center">
                    Configure your firmware
                </Typography>
                <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }} orientation="vertical">
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                            <StepContent>
                                {error && <ErrorPane error={error}></ErrorPane>}
                                
                                {!error && 
                                    <>
                                        {activeStep === 0 && <ConfigurationForm form={form} nextStep={buildConfig}/>}
                                        {(activeStep > 0 && activeStep < 4) && <ProgressStep value={statusValue} message={statusMessage} showRickOption={activeStep === 3}></ProgressStep>}
                                        {(activeStep === 4) && <FinishStep doAnother={doAnother} toConfig={toConfig}/>}
                                    </>
                                }
                            </StepContent>
                        </Step>
                    ))}
                </Stepper>
            </Paper>
        </Container>
    )
}