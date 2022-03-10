import { connect, ESPLoader } from "esp-web-flasher";
import { useMemo, useRef } from "react";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useSerial() {
    const espToolRef = useRef<ESPLoader | null>(null);
    const espStubRef = useRef<ESPLoader & { eraseFlash: () => Promise<void> } | null>(null);
    const serialSupported = useMemo(() => 'serial' in navigator, []);


    const serialConnect = async () => {
      
        if (espStubRef.current && espStubRef.current.connected && espToolRef.current && espToolRef.current.connected) return;
    
        espToolRef.current = await connect({ 
          debug: console.log,
          error: console.log,
          log: console.log
        });
        
        espToolRef.current.readLoop = async () => {
          if (!espToolRef.current) return ;

          const reader = espToolRef.current.port.readable.getReader();
          espToolRef.current.logger.debug("Starting read loop");
          (espToolRef.current as any)._reader = reader;
          try {
              while (true) {
                  const { value, done } = await reader.read();
                  if (done) {
                    reader.releaseLock();
                    break;
                  }

                  const event = new CustomEvent('serial-in', { detail: value })
                  espToolRef.current.dispatchEvent(event);
                  if (!value || value.length === 0) {
                    continue;
                  }
                  (espToolRef.current as any)._inputBuffer.push(...Array.from(value));
              }
          }
          catch (err) {
              console.error("Read loop got disconnected");
          }
          // Disconnected!
          espToolRef.current.connected = false;
          espToolRef.current.dispatchEvent(new Event("disconnect"));
          espToolRef.current.logger.debug("Finished read loop");
        }

        try {
          await espToolRef.current.initialize();
          
      
          espStubRef.current = await espToolRef.current.runStub();
        } catch (e) {
          await disconnect();
          throw e
        }
        // await espStubRef.current.initialize();

    }

    const disconnect  = async () => {

        if (!espToolRef.current || !espToolRef.current.connected) return;

        await sleep(100);
        await espToolRef.current.disconnect();
        await espToolRef.current.hardReset();
  
        await espToolRef.current.port.setSignals({
          dataTerminalReady: false,
          requestToSend: true,
        });
        await espToolRef.current.port.setSignals({
          dataTerminalReady: false,
          requestToSend: false,
        });
  
        await espToolRef.current.port.close();
    }


    return {
        serialConnect,
        disconnect,
        eraseFlash: () => espStubRef.current && espStubRef.current.eraseFlash(),
        isConnected: () => espToolRef.current && espToolRef.current.connected,
        setWifi: async (ssid: string, password: string) => {

          if (!espStubRef.current) 
            throw new Error('Connection not open');

          const port = espStubRef.current.port;
          
          await espStubRef.current.hardReset()


          await new Promise((resolve, reject) => {
            if (!espToolRef.current) return;

            let readBytes = new Uint8Array()

            const appendBuffer = function(buffer1: Uint8Array, buffer2: Uint8Array) {
              var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
              tmp.set(new Uint8Array(buffer1), 0);
              tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
              return tmp;
            };

            const onSerial = (value: any) => {
              if (!espToolRef.current) return;

              readBytes = appendBuffer(readBytes, value.detail)


              const decoded = new TextDecoder().decode(readBytes);

              if (decoded.includes('Connected successfully to SSID')) {
                espToolRef.current.removeEventListener('serial-in', onSerial)
                resolve(true);
              }
              if (decoded.includes(`Can't connect from any credentials`)) {
                espToolRef.current.removeEventListener('serial-in', onSerial)
                reject('Invalid credentials');
              }
            }

            espToolRef.current.addEventListener('serial-in', onSerial)

            const writer = port.writable.getWriter();
            writer.write(new TextEncoder().encode(`SET WIFI "${ssid}" "${password}"\n`));
            writer.releaseLock();


            setTimeout(() => {
              reject('timeout');
            }, 30000)
          })
           

          

        },
        serialSupported,
        espStubRef,
    }

}