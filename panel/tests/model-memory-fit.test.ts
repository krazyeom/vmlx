import { describe, it, expect } from 'vitest'
import {
  evaluateModelFit,
  parseExplicitMemoryRequirements,
  sortModelsByMacCompatibility,
  sortModelsByMacMemory,
  type MacHardwareSpecs,
} from '../src/shared/modelMemoryFit'

describe('parseExplicitMemoryRequirements', () => {
  it('parses DeepSeek V4.1 JANG_2K table markdown format', () => {
    const readme = `
# DeepSeek-V4.1-Flash-1017-JANG_2K
| Backbone | 45 weight shards, 2,214 tensors, **~197 GB resident** |
| Context | 1,048,576 tokens (YaRN) |
| Needs | a 256 GB Mac (serving footprint ~207 GB) |
    `
    const parsed = parseExplicitMemoryRequirements(readme)
    expect(parsed.requiredMacGb).toBe(256)
    expect(parsed.servingFootprintGb).toBe(207)
  })

  it('parses built for 128 GB Macs format', () => {
    const readme = `
built for 128 GB Macs with the n-gram table on SSD (~83 GiB resident).
    `
    const parsed = parseExplicitMemoryRequirements(readme)
    expect(parsed.requiredMacGb).toBe(128)
    expect(parsed.servingFootprintGb).toBe(83)
  })

  it('parses peak unified memory pattern', () => {
    const text = '7 s load, ~98 GB peak unified memory on a 128 GB Mac'
    const parsed = parseExplicitMemoryRequirements(text)
    expect(parsed.requiredMacGb).toBe(128)
    expect(parsed.servingFootprintGb).toBe(98)
  })

  it('parses Mistral Small 4 multi-column table with Fits On and RAM', () => {
    const readme = `
| Model | Size | Gen tok/s | Prefill tok/s | RAM | Fits On |
|-------|:----:|:---------:|:-------------:|:---:|---------|
| **JANG_6M (this model)** | **84 GB** | **74** | **160** | **95 GB** | **128+ GB Macs** |
| JANG_2L | 30 GB | 82 | 216 | 40 GB | 48 GB Macs |
    `
    const parsed = parseExplicitMemoryRequirements(readme)
    expect(parsed.requiredMacGb).toBe(128)
    expect(parsed.servingFootprintGb).toBe(95)
  })
})

describe('evaluateModelFit', () => {
  const mac64gb: MacHardwareSpecs = {
    chipName: 'Apple M5 Pro',
    chipFamily: 'M5',
    chipTier: 'pro',
    totalRamGb: 64,
    gpuDefaultLimitGb: 48,
    gpuMaxLimitGb: 58,
  }

  const mac256gb: MacHardwareSpecs = {
    chipName: 'Apple M5 Ultra',
    chipFamily: 'M5',
    chipTier: 'ultra',
    totalRamGb: 256,
    gpuDefaultLimitGb: 192,
    gpuMaxLimitGb: 230,
  }

  it('marks DeepSeek-V4.1-Flash-1017-JANG_2K as too_big on a 64 GB Mac', () => {
    const model = {
      id: 'JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K',
      size: '423.6 GB',
      note: 'Needs a 256 GB Mac (serving footprint ~207 GB)',
    }
    const fit = evaluateModelFit(model, mac64gb)
    expect(fit.status).toBe('too_big')
    expect(fit.badgeColor).toBe('rose')
    expect(fit.requiredMacGb).toBe(256)
    expect(fit.badgeLabel).toContain('✕ 실행 불가')
    expect(fit.badgeLabel).toContain('256 GB Mac 필요')
  })

  it('marks DeepSeek-V4.1-Flash-1017-JANG_2K as runs_well on a 256 GB Mac', () => {
    const model = {
      id: 'JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K',
      size: '423.6 GB',
      note: 'Needs a 256 GB Mac (serving footprint ~207 GB)',
    }
    const fit = evaluateModelFit(model, mac256gb)
    expect(fit.status).toBe('runs_well')
    expect(fit.badgeColor).toBe('emerald')
    expect(fit.badgeLabel).toContain('추천')
  })

  it('marks small model as recommended on a 64 GB Mac', () => {
    const model = {
      id: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
      size: '4.8 GB',
    }
    const fit = evaluateModelFit(model, mac64gb)
    expect(fit.status).toBe('runs_well')
    expect(fit.badgeColor).toBe('emerald')
    expect(fit.badgeLabel).toContain('추천')
  })

  it('marks borderline model as tight when near 90% GPU limit', () => {
    // 50 GB weights + headroom = ~55 GB needs, between 48 GB (75%) and 58 GB (90%)
    const model = {
      id: 'mlx-community/test-50gb-model',
      size: '50.0 GB',
    }
    const fit = evaluateModelFit(model, mac64gb)
    expect(fit.status).toBe('tight')
    expect(fit.badgeColor).toBe('amber')
    expect(fit.badgeLabel).toContain('주의')
  })
})

describe('sortModelsByMacCompatibility', () => {
  const mac64gb: MacHardwareSpecs = {
    chipName: 'Apple M5 Pro',
    chipFamily: 'M5',
    chipTier: 'pro',
    totalRamGb: 64,
    gpuDefaultLimitGb: 48,
    gpuMaxLimitGb: 58,
  }

  it('sorts recommended models to the top and too_big models to the bottom', () => {
    const models = [
      { id: 'JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K', size: '423.6 GB', note: 'Needs a 256 GB Mac' },
      { id: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '4.8 GB' },
      { id: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '20.0 GB' },
    ]

    const sorted = sortModelsByMacCompatibility(models, mac64gb)
    // 7B and 32B should be at the top, 256GB Mac model at the bottom
    expect(sorted[0].id).toBe('mlx-community/Qwen2.5-7B-Instruct-4bit')
    expect(sorted[1].id).toBe('mlx-community/Qwen2.5-32B-Instruct-4bit')
    expect(sorted[2].id).toBe('JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K')
  })

  it('sorts by comfortable (쾌적 순: lightest footprint first)', () => {
    const models = [
      { id: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '20.0 GB' },
      { id: 'JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K', size: '423.6 GB', note: 'Needs a 256 GB Mac' },
      { id: 'mlx-community/Qwen2.5-1.5B-Instruct-4bit', size: '1.2 GB' },
      { id: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '4.8 GB' },
    ]

    const sorted = sortModelsByMacMemory(models, mac64gb, {}, 'comfortable')
    // 쾌적 순: 1.5B (~1.2GB) -> 7B (~4.8GB) -> 32B (~20GB) -> 256GB Mac (too_big at bottom)
    expect(sorted[0].id).toBe('mlx-community/Qwen2.5-1.5B-Instruct-4bit')
    expect(sorted[1].id).toBe('mlx-community/Qwen2.5-7B-Instruct-4bit')
    expect(sorted[2].id).toBe('mlx-community/Qwen2.5-32B-Instruct-4bit')
    expect(sorted[3].id).toBe('JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K')
  })

  it('sorts by fullest_ram (사용 가능한 램에 가장 가득 찬 순: largest fitting model first)', () => {
    const models = [
      { id: 'mlx-community/Qwen2.5-1.5B-Instruct-4bit', size: '1.2 GB' },
      { id: 'JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K', size: '423.6 GB', note: 'Needs a 256 GB Mac' },
      { id: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '20.0 GB' },
      { id: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '4.8 GB' },
    ]

    const sorted = sortModelsByMacMemory(models, mac64gb, {}, 'fullest_ram')
    // 사용 가능한 램에 가장 가득 찬 순:
    // 32B (~20GB - fits Mac and utilizes most RAM) -> 7B (~4.8GB) -> 1.5B (~1.2GB) -> 256GB Mac (too_big at bottom)
    expect(sorted[0].id).toBe('mlx-community/Qwen2.5-32B-Instruct-4bit')
    expect(sorted[1].id).toBe('mlx-community/Qwen2.5-7B-Instruct-4bit')
    expect(sorted[2].id).toBe('mlx-community/Qwen2.5-1.5B-Instruct-4bit')
    expect(sorted[3].id).toBe('JANGQ-AI/DeepSeek-V4.1-Flash-1017-JANG_2K')
  })
})
