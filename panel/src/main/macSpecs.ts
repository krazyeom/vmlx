import { execSync } from 'child_process'
import { totalmem, cpus } from 'os'
import type { MacHardwareSpecs } from '../shared/modelMemoryFit'

let cachedSpecs: MacHardwareSpecs | null = null

export function getMacHardwareSpecs(): MacHardwareSpecs {
  if (cachedSpecs) return cachedSpecs

  let chipName = 'Apple Silicon'
  try {
    chipName = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf8' }).trim()
  } catch {
    const cpuList = cpus()
    if (cpuList.length > 0 && cpuList[0].model) {
      chipName = cpuList[0].model.trim()
    }
  }

  let totalRamBytes = totalmem()
  try {
    const rawMem = execSync('sysctl -n hw.memsize', { encoding: 'utf8' }).trim()
    const parsed = parseInt(rawMem, 10)
    if (!isNaN(parsed) && parsed > 0) totalRamBytes = parsed
  } catch {
    // fallback to totalmem()
  }

  const totalRamGb = Math.round(totalRamBytes / (1024 ** 3))

  let chipFamily: MacHardwareSpecs['chipFamily'] = 'Unknown'
  const chipLower = chipName.toLowerCase()
  if (chipLower.includes('m6')) chipFamily = 'M6'
  else if (chipLower.includes('m5')) chipFamily = 'M5'
  else if (chipLower.includes('m4')) chipFamily = 'M4'
  else if (chipLower.includes('m3')) chipFamily = 'M3'
  else if (chipLower.includes('m2')) chipFamily = 'M2'
  else if (chipLower.includes('m1')) chipFamily = 'M1'

  let chipTier: MacHardwareSpecs['chipTier'] = 'base'
  if (chipLower.includes('ultra')) chipTier = 'ultra'
  else if (chipLower.includes('max')) chipTier = 'max'
  else if (chipLower.includes('pro')) chipTier = 'pro'

  // macOS default GPU allocation limit is ~75% of unified memory
  const gpuDefaultLimitGb = Math.round(totalRamGb * 0.75)
  // Practical max wired limit is ~90%
  const gpuMaxLimitGb = Math.round(totalRamGb * 0.90)

  cachedSpecs = {
    chipName,
    chipFamily,
    chipTier,
    totalRamGb,
    gpuDefaultLimitGb,
    gpuMaxLimitGb,
  }
  return cachedSpecs
}
