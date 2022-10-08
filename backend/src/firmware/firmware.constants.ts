// In the format of [owner, [repo, [branches]]]
export const AVAILABLE_FIRMWARE_REPOS = new Map<string, Map<string, string[]>>([
  ['SlimeVR', new Map([['SlimeVR-Tracker-ESP', ['main']]])],
  ['deiteris', new Map([['SlimeVR-Tracker-ESP', ['qmc-mag-new', 'hmc-mag']]])],
  ['tianrui233', new Map([['SlimeVR-Tracker-ESP-For-Kitkat', ['qmc-axis-aligned-en', 'QMC-轴对齐-CN']]])],
  ['Lupinixx', new Map([['SlimeVR-Tracker-ESP', ['mpu6050-fifo']]])],
  ['0forks', new Map([['SlimeVR-Tracker-ESP-BMI160', ['v3dev', 'v3dev-bmm']]])],
  ['ButterscotchV', new Map([['SlimeVR-Tracker-ESP', ['arduino-latest']]])],
]);

export function forEachFirmwareOwner(callbackfn: (owner: string, repo: Map<string, string[]>) => void) {
  for (let [owner, repos] of AVAILABLE_FIRMWARE_REPOS) {
    callbackfn(owner, repos);
  }
}

export function forEachFirmwareRepo(callbackfn: (owner: string, repo: string, branch: string[]) => void) {
  for (let [owner, repos] of AVAILABLE_FIRMWARE_REPOS) {
    for (let [repo, branches] of repos) {
      callbackfn(owner, repo, branches);
    }
  }
}

export function forEachFirmwareBranch(callbackfn: (owner: string, repo: string, branch: string) => void) {
  for (let [owner, repos] of AVAILABLE_FIRMWARE_REPOS) {
    for (let [repo, branches] of repos) {
      for (let branch of branches) {
        callbackfn(owner, repo, branch);
      }
    }
  }
}
