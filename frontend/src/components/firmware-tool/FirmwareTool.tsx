import { Alert, Container, Paper, Step, StepContent, StepLabel, Stepper, Typography } from "@mui/material";
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