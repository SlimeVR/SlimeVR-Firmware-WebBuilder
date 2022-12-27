import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "../components/firmware-tool/ErrorPane";
import { FirmwareFile, useFirmwareControllerBuildAll } from "../generated-types";
import { useSerial } from "./serial";
import * as Sentry from "@sentry/react";
import { decode, encode } from "universal-base64url";

const defaultFormValues = {
    version: null,
    board: {
      type: null,
      pins: {
        imuSDA: null,
        imuSCL: null,
        led: null,
      },
      enableLed: true,
    },
    imus: [
      {
        enabled: true,
        type: null,
        rotation: 0,
        imuINT: null,
      },
      {
        enabled: false,
        type: null,
        rotation: 0,
        imuINT: null,
      },
    ],
    battery: {
      type: null,
      resistance: null,
      pin: null
    },
    wifi: {
      ssid: null,
      password: null,
    }
};

type DonwloadedFile = { infos: FirmwareFile, binary: ArrayBuffer };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useFirmwareTool() {
    const form = useForm({ defaultValues: defaultFormValues });

    const { serialConnect, espStubRef, disconnect, setWifi } = useSerial()


    const formValue = form.watch();

    useEffect(() => {
      const params = new URL(window.location.href).searchParams;

      try {
        if (params.has('config')) {
          const str = decode(params.get('config') as string);
        
          const config = JSON.parse(str)
          form.reset(config, { keepDirty: false, keepTouched: false })
        }
      } catch (e) {
        setCurrentError({ 
          title: 'Could not load config', 
          message: '', 
          action: () => { 
            setCurrentError(null) 
            setActiveStep(0)
            window.history.replaceState(null, '', window.location.pathname);
          },
          actionText: 'Reset configuration'
        })
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])


    useEffect(() => {
      if (formValue && formValue.board.type && formValue.version) {
        const { wifi, ...data } = formValue;
        const json = encode( JSON.stringify(data) );
        window.history.replaceState(null, '', `?config=${json}`);
      }
    }, [formValue])



    const wifi = form.watch('wifi');


    // const [wifi, setWifiSettings] = useState<{ ssid: string, password:string } | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [statusMessage, setStatusMessage] = useState('')
    const [error, setCurrentError] = useState<ErrorMessage | null>(null);
    const downloadedFilesRef = useRef<DonwloadedFile[] | null>(null);
    const [statusValue, setStatusValue] = useState<number | null>(null)
  
    const { mutate } = useFirmwareControllerBuildAll({})

    const flash = async () => {
        
      if (!downloadedFilesRef.current)
        throw new Error('Download Files not defined')
       
  
      setActiveStep(3);
      setStatusValue(0);
  
      setStatusMessage(`Connecting to ESP`)
  
    
  
      try {

        await serialConnect();

        if (!espStubRef.current)
          throw new Error('Invalid state. no stub ref')


        const totalSize  = downloadedFilesRef.current.reduce((size, file) => size + file.binary.byteLength, 0);
        let totalWriten = 0;
        setStatusValue(0);
  

        // await espStubRef.current.hardReset()
        for (const file of downloadedFilesRef.current) {
          // eslint-disable-next-line no-loop-func
          await espStubRef.current.flashData(file.binary, (bytes) => {
            const percents = Math.floor(((totalWriten + bytes) / totalSize) * 100);
            setStatusValue(percents);
            setStatusMessage(`Flashing firmware (${percents}%)`)
          }, file.infos.offset, true);
          totalWriten += file.binary.byteLength;
        }
  
        if (wifi && wifi.password && wifi.ssid) {
          setStatusMessage(`Setting wifi credentials`)
          setStatusValue(null);
          await sleep(1000)
        


          try {
          await setWifi(wifi.ssid, wifi.password);
          } catch (e) {
            if (e === 'Invalid credentials') {
              setCurrentError({ 
                title: 'Could not connect to wifi, Invalid credentials', 
                message: 'Check the configuration', 
                action: () => { 
                  setCurrentError(null) 
                  setActiveStep(0)
                },
                actionText: 'Go back to configuration'
              })
              await disconnect();
              return;
            } else {
              setCurrentError({ 
                title: 'Lost connection to serial', 
                message: 'Something did go wrong',
                action: () => { 
                  setCurrentError(null) 
                  flash()
                },
                actionText: 'Retry' 
              })
              await disconnect();
              return;
            }
          }
        }
        await disconnect();
        setActiveStep(4);
  
      } catch (e) {
        setCurrentError({ 
          title: 'Unable to connect to serial', 
          message: 'Check that you have the right drivers. You can also hold the Boot button on your esp if you have one',
          action: () => { 
            setCurrentError(null) 
            flash()
          },
          actionText: 'Retry' 
        })
        await disconnect();
        throw e
      }
    }
  
    const downloadBuild = async (id: string, firmwareFiles: FirmwareFile[]) => {
     
      setActiveStep(2)
  
      setStatusMessage('Downloading Firmware');
  
      const firmwaresBytes = await Promise.all(
        firmwareFiles.map(({ url }) => 
          fetch(`${process.env.REACT_APP_SLIMEVR_S3}/${url}`)
            .then(res => res.arrayBuffer())
        )
      )
  
      downloadedFilesRef.current = firmwareFiles.map((file ,index) =>( {
        infos: file,
        binary: firmwaresBytes[index]
      }))
      flash()
    }
  
  
    const buildConfig = async (buildSettings: any) => {
      const { wifi , ...data }: any = buildSettings;
  
      setStatusMessage('Start building');
      setActiveStep(1)
  
      const connectError = { 
        title: 'Unable to connect to serial', 
        message: 'Check that you have the right drivers. You can also hold the Boot button on your esp if you have one. Also check that you dont have any program like SlimeVR server or Cura Open',
        action: () => { 
          setCurrentError(null) 
          buildConfig(buildSettings);
        },
        actionText: 'Retry' 
      }
  
  
      try {
        await serialConnect()
      } catch (e) {
        setCurrentError(connectError)
        return;
      }
  
      const res = await mutate(data)
  
      Sentry.setContext("buildConfig", { config: JSON.stringify(data) });
      Sentry.setContext("buildResponse", res);
  
  
      try {
        const buildFailedError = { 
          title: 'Unable to build the firmware', 
          message: 'Check the configuration', 
          action: () => { 
            setCurrentError(null) 
            setActiveStep(0)
          },
          actionText: 'Go back to configuration'
        }
  
        if (res.status === 'BUILDING') {
          const events = new EventSource(`${process.env.REACT_APP_API_BASE}/firmwares/build-status/${res.id}`)
          events.onmessage = ({ data }) => {
            const { buildStatus, id, message, firmwareFiles }: { buildStatus: string, id: string, message: string, firmwareFiles?: FirmwareFile[] } = JSON.parse(data);
            
            setStatusMessage(message);
            if (buildStatus === 'DONE') {
              downloadBuild(id, firmwareFiles!);
            } else if (buildStatus === 'FAILED') {
              setCurrentError(buildFailedError)
            }
          }
        } else if (res.status === 'DONE') {
          downloadBuild(res.id, res.firmwareFiles!);
        } else if (res.status === 'FAILED') {
          setCurrentError(buildFailedError)
        }
  
      } catch (e) {
        setCurrentError(connectError)
        throw e
      }
    }

    return {
        form,
        activeStep,
        statusMessage,
        error,
        statusValue,
        buildConfig,
        flash,
        toConfig: () =>{ 
          setActiveStep(0)
          setCurrentError(null);
        }
    }   
}