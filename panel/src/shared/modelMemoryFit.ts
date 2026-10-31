/**
 * Model memory fit calculation based on mlx.app (https://mlx.app/ko/mac).
 * Evaluates whether an MLX model is recommended, tight, slow, or too big
 * for the user's specific Mac Apple Silicon unified memory configuration.
 */

export interface MacHardwareSpecs {
  chipName: string;          // e.g. "Apple M5 Pro", "Apple M1", "Apple M3 Max"
  chipFamily: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'Unknown';
  chipTier: 'base' | 'pro' | 'max' | 'ultra' | 'unknown';
  totalRamGb: number;        // e.g. 8, 16, 24, 32, 36, 48, 64, 96, 128, 192, 256, 512
  gpuDefaultLimitGb: number; // ~75% of unified memory (macOS default GPU limit)
  gpuMaxLimitGb: number;     // ~90% of unified memory (practical wired memory limit)
}

export type MemoryFitStatus =
  | 'runs_well'      // 쾌적하게 실행 (Recommended / Comfortable)
  | 'tight'          // 겨우 들어감 (Tight fit / Borderline)
  | 'slow'           // 실행되지만 느림 (Runs but slow)
  | 'too_big'        // 너무 큼 (Not recommended / Too big / OOM risk)
  | 'unknown';       // 정보 부족

export type MacMemorySortOrder =
  | 'compatibility' // 기본 추천 순 (호환성 우선)
  | 'comfortable'   // 쾌적 순 (여유 메모리 많은 순 · 가볍고 빠름)
  | 'fullest_ram';  // 사용 가능한 램에 가장 가득 찬 순 (가용 범위 내 대형 모델 우선)

export interface ModelFitEvaluation {
  status: MemoryFitStatus;
  badgeLabel: string;        // Short badge text, e.g. "추천 (쾌적)" / "비추천 (너무 큼)"
  badgeColor: 'emerald' | 'amber' | 'rose' | 'muted';
  detailMessage: string;     // Friendly explanation for tooltip / panel
  estimatedNeedsGb?: number; // Estimated RAM needed (weights + context headroom)
  requiredMacGb?: number;    // Explicit Mac size required (e.g. 256 GB)
  servingFootprintGb?: number; // Explicit footprint (e.g. 207 GB)
  mlxAppUrl?: string;        // Link to mlx.app for this Mac
}

/**
 * Curated knowledge base of known large and community models.
 * Matches explicit demands from release notes (e.g., JANGQ models, DeepSeek V4.1, etc.).
 */
export const KNOWN_MODEL_MEMORY_REQUIREMENTS: Record<string, {
  requiredMacGb?: number;
  servingFootprintGb?: number;
  note?: string;
}> = {
  // DeepSeek V4.1 JANG_2K - Needs a 256 GB Mac (serving footprint ~207 GB)
  'deepseek-v4.1-flash-1017-jang_2k': {
    requiredMacGb: 256,
    servingFootprintGb: 207,
    note: 'Needs a 256 GB Mac (serving footprint ~207 GB)',
  },
  // MiMo V2.6 Flash MOPD JANGHT2.5 - built for 128 GB Macs (91.5 GB active)
  'mimo-v2.6-flash-mopd-janght2.5': {
    requiredMacGb: 128,
    servingFootprintGb: 92,
    note: 'Built for 128 GB Macs (serving footprint ~91.5 GB)',
  },
  // Qwen 3.8 Flash Next JANG_6S - built for 128 GB Macs (~83 GiB resident)
  'qwen3.8-flash-next-jang_6s': {
    requiredMacGb: 128,
    servingFootprintGb: 83,
    note: 'Built for 128 GB Macs (~83 GiB resident)',
  },
  // Qwen 3.8 Flash Next JANGH4
  'qwen3.8-flash-next-jangh4': {
    requiredMacGb: 128,
    servingFootprintGb: 80,
    note: 'Built for 128 GB Macs',
  },
  // Naive N0.5 Flash JANGHT2.5
  'naive-n0.5-flash-janght2.5': {
    requiredMacGb: 128,
    servingFootprintGb: 88,
    note: 'Built for 128 GB Macs',
  },
  // GLM-5.3 Flash JANGHT2.4
  'glm-5.3-flash-janght2.4': {
    requiredMacGb: 128,
    servingFootprintGb: 88,
    note: 'Built for 128 GB Macs',
  },
  // DeepSeek V4 Flash 0731 JANG - ~98 GB peak
  'deepseek-v4-flash-0731-jang': {
    requiredMacGb: 128,
    servingFootprintGb: 98,
    note: 'Built for 128 GB Macs (~98 GB peak unified memory)',
  },
  // DeepSeek V4.1 Flash 1017 official MLX
  'deepseek-v4.1-flash-1017': {
    requiredMacGb: 256,
    servingFootprintGb: 210,
    note: 'Requires 256 GB Mac (~210 GB footprint)',
  },
  // Kimi K3
  'kimi-k3': {
    requiredMacGb: 512,
    servingFootprintGb: 430,
    note: 'Requires 512 GB Mac',
  },
  // Kimi K2.7 Code / K2.6
  'kimi-k2.7-code': {
    requiredMacGb: 256,
    servingFootprintGb: 180,
    note: 'Requires 256 GB Mac',
  },
  'kimi-k2.6': {
    requiredMacGb: 256,
    servingFootprintGb: 180,
    note: 'Requires 256 GB Mac',
  },
  // Mistral Small 4 119B JANG_6M - Fits on 128+ GB Macs (~95 GB serving RAM)
  'mistral-small-4-119b-a6b-jang_6m': {
    requiredMacGb: 128,
    servingFootprintGb: 95,
    note: 'Fits on 128+ GB Macs (~95 GB RAM)',
  },
  'mistral-small-4-119b': {
    requiredMacGb: 128,
    servingFootprintGb: 95,
    note: 'Fits on 128+ GB Macs',
  },
  // Llama 3.3 70B 4bit (~40 GB weights -> needs ~45 GB -> 64 GB Mac)
  'llama-3.3-70b': {
    requiredMacGb: 64,
    servingFootprintGb: 45,
    note: 'Requires 64 GB Mac (~45 GB footprint)',
  },
  // DeepSeek V3/V4 671B / Pro
  'deepseek-v4-pro': {
    requiredMacGb: 512,
    servingFootprintGb: 400,
    note: 'Requires 512 GB Mac',
  },
};

/**
 * Parse human size string (e.g., "197 GB", "14.2 GB", "850 MB", "423.6 GB / 394.5 GiB") to GB float.
 */
export function parseSizeToGb(sizeStr?: string | null): number | undefined {
  if (!sizeStr) return undefined;

  const match = sizeStr.match(/([\d.]+)\s*(GB|GiB|TB|TiB|MB|MiB)/i);
  if (!match) return undefined;

  const val = parseFloat(match[1]);
  if (isNaN(val)) return undefined;

  const unit = match[2].toUpperCase();
  if (unit.startsWith('T')) return val * 1024;
  if (unit.startsWith('G')) return val;
  if (unit.startsWith('M')) return val / 1024;
  return undefined;
}

/**
 * Extract explicit Mac memory requirement or footprint from model README/note/description.
 * Matches patterns like:
 * - "Needs a 256 GB Mac (serving footprint ~207 GB)"
 * - "built for 128 GB Macs"
 * - "for 128 GB Macs"
 * - "~98 GB peak unified memory"
 * - "~197 GB resident"
 */
export function parseExplicitMemoryRequirements(text?: string | null): {
  requiredMacGb?: number;
  servingFootprintGb?: number;
  rawSnippet?: string;
} {
  if (!text) return {};

  let requiredMacGb: number | undefined;
  let servingFootprintGb: number | undefined;
  let rawSnippet: string | undefined;

  // 1. "Fits on 128+ GB Macs" / "Needs a 256 GB Mac" / "built for 128 GB Macs" / "on a 128 GB Mac" / "for 128 GB Macs"
  const macMatch = text.match(/(?:fits\s+(?:on|in)\s+(?:a\s+)?|needs\s+(?:a\s+)?|built\s+for\s+|for\s+|on\s+(?:a\s+)?)(\d+)\+?\s*GB\s+Mac/i);
  if (macMatch) {
    requiredMacGb = parseInt(macMatch[1], 10);
    rawSnippet = macMatch[0];
  }

  // 2. Multi-column table with "Fits On" and "RAM" columns (e.g. Mistral Small 4 README)
  const tableLines = text.split('\n');
  let fitsColIdx = -1;
  let ramColIdx = -1;
  for (const line of tableLines) {
    if (line.includes('|') && /Fits\s+On/i.test(line)) {
      const headerCols = line.split('|').map(c => c.trim().toLowerCase());
      fitsColIdx = headerCols.findIndex(c => c.includes('fits on'));
      ramColIdx = headerCols.findIndex(c => c === 'ram' || c.includes('footprint') || c.includes('resident'));
      continue;
    }
    if (fitsColIdx !== -1 && line.includes('|') && (line.toLowerCase().includes('(this model)') || line.includes('**'))) {
      const cols = line.split('|').map(c => c.trim());
      if (cols[fitsColIdx]) {
        const cellFits = cols[fitsColIdx].match(/(\d+)\+?\s*GB\s*Mac/i);
        if (cellFits && !requiredMacGb) {
          requiredMacGb = parseInt(cellFits[1], 10);
          rawSnippet = cols[fitsColIdx].replace(/\*/g, '');
        }
      }
      if (ramColIdx !== -1 && cols[ramColIdx]) {
        const cellRam = cols[ramColIdx].match(/([\d.]+)\s*(?:GB|GiB)/i);
        if (cellRam && !servingFootprintGb) {
          servingFootprintGb = parseFloat(cellRam[1]);
          if (!rawSnippet) rawSnippet = cols[ramColIdx].replace(/\*/g, '');
        }
      }
      break;
    }
  }

  // 3. Footprint / Resident prefix patterns: "serving footprint ~207 GB", "resident ~197 GB", "~98 GB peak"
  const prefixFpMatch = text.match(/(?:serving\s+footprint|active\s+footprint|weights\s+resident|resident|peak\s+unified\s+memory)\s*~?\s*([\d.]+)\s*(?:GB|GiB)/i);
  if (prefixFpMatch && !servingFootprintGb) {
    servingFootprintGb = parseFloat(prefixFpMatch[1]);
    if (!rawSnippet) rawSnippet = prefixFpMatch[0];
  }

  // 4. Suffix patterns: "~83 GiB resident", "~98 GB peak"
  if (!servingFootprintGb) {
    const suffixFpMatch = text.match(/~?\s*([\d.]+)\s*(?:GB|GiB)\s+(?:resident|active|peak|serving\s+footprint)/i);
    if (suffixFpMatch) {
      servingFootprintGb = parseFloat(suffixFpMatch[1]);
      if (!rawSnippet) rawSnippet = suffixFpMatch[0];
    }
  }

  // 5. Markdown 2-column table patterns: "| Needs | a 256 GB Mac |" or "| Fits On | 128+ GB Macs |"
  const tableNeedsMatch = text.match(/\|\s*(?:Needs|Fits\s+On)\s*\|\s*([^|\n]+)/i);
  if (tableNeedsMatch) {
    const tableCell = tableNeedsMatch[1].trim();
    const cellMac = tableCell.match(/(\d+)\+?\s*GB\s*Mac/i);
    if (cellMac && !requiredMacGb) {
      requiredMacGb = parseInt(cellMac[1], 10);
      rawSnippet = tableCell;
    }
    const cellFp = tableCell.match(/(?:footprint|resident|ram)\s*~?\s*([\d.]+)\s*(?:GB|GiB)/i);
    if (cellFp && !servingFootprintGb) {
      servingFootprintGb = parseFloat(cellFp[1]);
      if (!rawSnippet) rawSnippet = tableCell;
    }
  }

  return { requiredMacGb, servingFootprintGb, rawSnippet };
}

/**
 * Heuristically estimate parameter count in billions from model repo ID.
 * e.g. "Qwen2.5-72B-Instruct" -> 72
 * "DeepSeek-V4.1-Flash" -> 552
 * "Llama-3-8B" -> 8
 */
export function estimateParamCountFromId(repoId: string): number | undefined {
  const idLower = repoId.toLowerCase();
  if (idLower.includes('deepseek-v4.1-flash') || idLower.includes('deepseek-v4-flash')) return 552;
  if (idLower.includes('mimo-v2.6-flash')) return 310;
  if (idLower.includes('glm-5.3-flash')) return 320;
  if (idLower.includes('glm-5.3')) return 744;

  const match = repoId.match(/(?:^|[-_])(\d+(?:\.\d+)?)[bB](?:[-_]|$)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0 && val < 5000) return val;
  }
  return undefined;
}

/**
 * Heuristically estimate quantization bits from model repo ID.
 * e.g. "4bit" -> 4, "8bit" -> 8, "JANG_2K" -> 2.5, "fp16" -> 16
 */
export function estimateBitsFromId(repoId: string): number {
  const lower = repoId.toLowerCase();
  if (lower.includes('jang_2k') || lower.includes('jangh2') || lower.includes('2bit')) return 2.5;
  if (lower.includes('jang_4d') || lower.includes('jang_4m') || lower.includes('jangh4') || lower.includes('4bit') || lower.includes('q4')) return 4.5;
  if (lower.includes('jang_6s') || lower.includes('jang_6m') || lower.includes('6bit') || lower.includes('q6')) return 6.5;
  if (lower.includes('jang_8m') || lower.includes('8bit') || lower.includes('q8')) return 8.5;
  if (lower.includes('fp16') || lower.includes('bf16')) return 16;
  return 4.5;
}

/**
 * Evaluates whether a model fits the specified Mac hardware.
 * Uses mlx.app criteria:
 * - macOS default GPU limit is ~75% of unified memory
 * - Maximum wired memory limit is ~90%
 * - Context & runtime buffer: weights + max(1.5 GB, weights * 8%)
 */
function resolveI18n(
  t: ((key: string, params?: Record<string, string | number>) => string) | undefined,
  key: string,
  params: Record<string, string | number> | undefined,
  fallback: string
): string {
  if (!t) return fallback;
  const res = t(key, params);
  if (!res || res === key) return fallback;
  return res;
}

export function evaluateModelFit(
  model: {
    id: string;
    size?: string;
    note?: string;
    tags?: string[];
  },
  macSpecs: MacHardwareSpecs | null,
  readmeText?: string | null,
  t?: (key: string, params?: Record<string, string | number>) => string
): ModelFitEvaluation {
  if (!macSpecs || macSpecs.totalRamGb <= 0) {
    return {
      status: 'unknown',
      badgeLabel: resolveI18n(t, 'sessions.download.fit.unknown', undefined, '확인 필요'),
      badgeColor: 'muted',
      detailMessage: 'Mac 하드웨어 사양을 감지하는 중입니다.',
    };
  }

  const { totalRamGb, gpuDefaultLimitGb, gpuMaxLimitGb } = macSpecs;
  const combinedText = `${model.note || ''}\n${readmeText || ''}\n${(model.tags || []).join(' ')}`;
  const explicit = parseExplicitMemoryRequirements(combinedText);

  // Check known curated models map if explicit info is not in the text
  const cleanId = model.id.toLowerCase().replace(/^[^/]+\//, '');
  for (const [key, known] of Object.entries(KNOWN_MODEL_MEMORY_REQUIREMENTS)) {
    if (cleanId.includes(key)) {
      if (!explicit.requiredMacGb && known.requiredMacGb) {
        explicit.requiredMacGb = known.requiredMacGb;
      }
      if (!explicit.servingFootprintGb && known.servingFootprintGb) {
        explicit.servingFootprintGb = known.servingFootprintGb;
      }
      break;
    }
  }

  // 1. Explicit Mac requirements (e.g., JANGQ: "Needs a 256 GB Mac", "for 128 GB Macs")
  if (explicit.requiredMacGb) {
    const reqMac = explicit.requiredMacGb;
    const footprint = explicit.servingFootprintGb;

    if (totalRamGb >= reqMac) {
      return {
        status: 'runs_well',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeRunsWellExplicit', { mac: reqMac }, `✓ 추천 (${reqMac} GB Mac 권장)`),
        badgeColor: 'emerald',
        requiredMacGb: reqMac,
        servingFootprintGb: footprint,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailRunsWellExplicit', { current: totalRamGb, req: reqMac }, `현재 Mac(${totalRamGb} GB)은 이 모델의 권장 사양(${reqMac} GB Mac)을 충족하여 쾌적하게 실행할 수 있습니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    } else {
      return {
        status: 'too_big',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeTooBigExplicit', { mac: reqMac }, `✕ 실행 불가 (${reqMac} GB Mac 필요)`),
        badgeColor: 'rose',
        requiredMacGb: reqMac,
        servingFootprintGb: footprint,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailTooBigExplicit', { current: totalRamGb, req: reqMac, footprint: footprint || Math.round(reqMac * 0.8) }, `이 모델은 최소 ${reqMac} GB Mac(권장 풋프린트: ~${footprint || Math.round(reqMac * 0.8)} GB)이 필요합니다. 현재 Mac(${totalRamGb} GB)에서는 다운로드해도 메모리 부족(OOM)으로 실행되지 않습니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    }
  }

  // 2. Explicit serving footprint (e.g. "serving footprint ~207 GB", "98 GB peak unified memory")
  if (explicit.servingFootprintGb) {
    const footprint = explicit.servingFootprintGb;
    if (footprint <= gpuDefaultLimitGb) {
      return {
        status: 'runs_well',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeRunsWellFootprint', { footprint: footprint.toFixed(0) }, `✓ 추천 (~${footprint.toFixed(0)} GB · 쾌적)`),
        badgeColor: 'emerald',
        servingFootprintGb: footprint,
        estimatedNeedsGb: footprint,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailRunsWellFootprint', { footprint: footprint.toFixed(0), gpuLimit: gpuDefaultLimitGb }, `서빙 메모리 약 ${footprint.toFixed(0)} GB로 현재 Mac(기본 GPU 한도: ${gpuDefaultLimitGb} GB)에서 여유롭게 실행됩니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    } else if (footprint <= gpuMaxLimitGb) {
      return {
        status: 'tight',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeTightFootprint', { footprint: footprint.toFixed(0) }, `⚠ 주의 (~${footprint.toFixed(0)} GB · 겨우 들어감)`),
        badgeColor: 'amber',
        servingFootprintGb: footprint,
        estimatedNeedsGb: footprint,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailTightFootprint', { footprint: footprint.toFixed(0), current: totalRamGb }, `서빙 메모리 약 ${footprint.toFixed(0)} GB로 현재 Mac(${totalRamGb} GB)의 메모리 경계에 가깝습니다. GPU 메모리 한도를 높이고 컨텍스트를 짧게 유지하세요.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    } else {
      return {
        status: 'too_big',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeTooBigFootprint', { footprint: footprint.toFixed(0) }, `✕ 실행 불가 (~${footprint.toFixed(0)} GB 필요)`),
        badgeColor: 'rose',
        servingFootprintGb: footprint,
        estimatedNeedsGb: footprint,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailTooBigFootprint', { footprint: footprint.toFixed(0), current: totalRamGb }, `서빙 메모리 약 ${footprint.toFixed(0)} GB가 필요하여 현재 Mac(${totalRamGb} GB)의 최대 가용량을 초과합니다. 다운로드해도 실행되지 않습니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    }
  }

  // 3. Size-based calculation (from safetensors or model.size)
  const sizeGb = parseSizeToGb(model.size);
  let estimatedWeightsGb = sizeGb;

  // Fallback to parameter & quantization heuristic if size is missing or looks suspicious (e.g. > 1000 GB)
  if (!estimatedWeightsGb || estimatedWeightsGb > 1000) {
    const params = estimateParamCountFromId(model.id);
    if (params) {
      const bits = estimateBitsFromId(model.id);
      estimatedWeightsGb = (params * bits) / 8;
    }
  }

  if (estimatedWeightsGb && estimatedWeightsGb > 0) {
    // mlx.app formula: needs_gb = weights + max(1.5, weights * 0.08)
    const contextHeadroom = Math.max(1.5, estimatedWeightsGb * 0.08);
    const needsGb = Math.round((estimatedWeightsGb + contextHeadroom) * 10) / 10;

    if (needsGb <= gpuDefaultLimitGb) {
      return {
        status: 'runs_well',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeRunsWellCalc', { needs: needsGb }, `✓ 추천 (${needsGb} GB · 쾌적)`),
        badgeColor: 'emerald',
        estimatedNeedsGb: needsGb,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailRunsWellCalc', {
          needs: needsGb,
          weights: estimatedWeightsGb.toFixed(1),
          current: totalRamGb,
          gpuLimit: gpuDefaultLimitGb,
        }, `필요 메모리 약 ${needsGb} GB (가중치 ${estimatedWeightsGb.toFixed(1)} GB + 컨텍스트). 현재 Mac(${totalRamGb} GB, GPU 한도 ${gpuDefaultLimitGb} GB)에서 쾌적하게 실행됩니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    } else if (needsGb <= gpuMaxLimitGb) {
      return {
        status: 'tight',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeTightCalc', { needs: needsGb }, `⚠ 주의 (${needsGb} GB · 겨우 들어감)`),
        badgeColor: 'amber',
        estimatedNeedsGb: needsGb,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailTightCalc', {
          needs: needsGb,
          current: totalRamGb,
        }, `필요 메모리 약 ${needsGb} GB. 현재 Mac(${totalRamGb} GB)의 메모리를 거의 다 씁니다. GPU 메모리 한도를 올리고 컨텍스트를 짧게 유지하세요.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    } else {
      return {
        status: 'too_big',
        badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeTooBigCalc', { needs: needsGb }, `✕ 실행 불가 (${needsGb} GB 필요)`),
        badgeColor: 'rose',
        estimatedNeedsGb: needsGb,
        detailMessage: resolveI18n(t, 'sessions.download.fit.detailTooBigCalc', {
          needs: needsGb,
          current: totalRamGb,
        }, `필요 메모리 약 ${needsGb} GB로 현재 Mac(${totalRamGb} GB)의 가용량을 초과합니다. 다운로드해도 실행되지 않습니다.`),
        mlxAppUrl: `https://mlx.app/ko/mac`,
      };
    }
  }

  // 4. Default / Unknown
  return {
    status: 'unknown',
    badgeLabel: resolveI18n(t, 'sessions.download.fit.badgeUnknown', undefined, '메모리 미확인'),
    badgeColor: 'muted',
    detailMessage: resolveI18n(t, 'sessions.download.fit.detailUnknown', undefined, '정확한 모델 가중치 크기를 확인할 수 없습니다.'),
  };
}

/**
 * Extract an estimated numeric memory footprint in GB for a model.
 */
export function getModelEstimatedMemoryGb(
  model: { id: string; size?: string; note?: string; tags?: string[] },
  _macSpecs?: MacHardwareSpecs | null,
  readmeText?: string | null
): number {
  const combinedText = `${model.note || ''}\n${readmeText || ''}\n${(model.tags || []).join(' ')}`;
  const explicit = parseExplicitMemoryRequirements(combinedText);

  const cleanId = model.id.toLowerCase().replace(/^[^/]+\//, '');
  for (const [key, known] of Object.entries(KNOWN_MODEL_MEMORY_REQUIREMENTS)) {
    if (cleanId.includes(key)) {
      if (!explicit.requiredMacGb && known.requiredMacGb) {
        explicit.requiredMacGb = known.requiredMacGb;
      }
      if (!explicit.servingFootprintGb && known.servingFootprintGb) {
        explicit.servingFootprintGb = known.servingFootprintGb;
      }
      break;
    }
  }

  if (explicit.servingFootprintGb) return explicit.servingFootprintGb;
  if (explicit.requiredMacGb) return explicit.requiredMacGb * 0.8;

  const sizeGb = parseSizeToGb(model.size);
  if (sizeGb && sizeGb > 0 && sizeGb <= 1000) {
    const contextHeadroom = Math.max(1.5, sizeGb * 0.08);
    return Math.round((sizeGb + contextHeadroom) * 10) / 10;
  }

  const params = estimateParamCountFromId(model.id);
  if (params) {
    const bits = estimateBitsFromId(model.id);
    const weights = (params * bits) / 8;
    const contextHeadroom = Math.max(1.5, weights * 0.08);
    return Math.round((weights + contextHeadroom) * 10) / 10;
  }

  return 0;
}

/**
 * Sorts models by Mac memory compatibility and user-specified order:
 * - 'compatibility': Recommended & runs well first, borderline next, too big at the bottom.
 * - 'comfortable': 쾌적 순 — comfortable models first, sorted by lightest memory footprint (fastest & lowest resource use).
 * - 'fullest_ram': 사용가능한 램에 가장 가득찬 순 — runs on this Mac and maximizes unified RAM utilization (largest model that fits).
 */
export function sortModelsByMacMemory<T extends { id: string; size?: string; note?: string; tags?: string[] }>(
  models: T[],
  macSpecs: MacHardwareSpecs | null,
  readmeCache: Record<string, string> = {},
  order: MacMemorySortOrder = 'compatibility'
): T[] {
  if (!macSpecs || macSpecs.totalRamGb <= 0) return models;

  const evaluated = models.map(m => {
    const fit = evaluateModelFit(m, macSpecs, readmeCache[m.id]);
    let memGb = fit.servingFootprintGb || fit.estimatedNeedsGb;
    if (!memGb && fit.requiredMacGb) {
      memGb = fit.requiredMacGb * 0.8;
    }
    if (!memGb) {
      memGb = getModelEstimatedMemoryGb(m, macSpecs, readmeCache[m.id]);
    }
    return { model: m, fit, memGb: memGb || 0 };
  });

  evaluated.sort((a, b) => {
    const isTooBigA = a.fit.status === 'too_big';
    const isTooBigB = b.fit.status === 'too_big';

    // Too big models (exceeding Mac RAM) are always placed at the bottom
    if (isTooBigA !== isTooBigB) {
      return isTooBigA ? 1 : -1;
    }

    if (order === 'comfortable') {
      // 쾌적 순:
      // 1. Status: runs_well (0) -> tight/slow (1) -> unknown (2) -> too_big (3)
      const statusRank = (s: MemoryFitStatus) => {
        if (s === 'runs_well') return 0;
        if (s === 'tight' || s === 'slow') return 1;
        if (s === 'unknown') return 2;
        return 3;
      };
      const rankDiff = statusRank(a.fit.status) - statusRank(b.fit.status);
      if (rankDiff !== 0) return rankDiff;

      // 2. Lightest memory footprint first (ascending RAM)
      if (a.memGb > 0 && b.memGb > 0 && Math.abs(a.memGb - b.memGb) >= 0.1) {
        return a.memGb - b.memGb;
      }
      return 0;
    }

    if (order === 'fullest_ram') {
      // 사용가능한 램에 가장 가득찬 순:
      // Within runnable models, prioritize the largest model that fits within Mac limits (descending RAM)
      if (!isTooBigA && !isTooBigB) {
        if (a.memGb > 0 && b.memGb > 0 && Math.abs(a.memGb - b.memGb) >= 0.1) {
          return b.memGb - a.memGb;
        }
        if (a.memGb > 0 && b.memGb <= 0) return -1;
        if (b.memGb > 0 && a.memGb <= 0) return 1;
      } else if (isTooBigA && isTooBigB) {
        // For models that exceed RAM, sort by ascending excess
        if (a.memGb > 0 && b.memGb > 0 && Math.abs(a.memGb - b.memGb) >= 0.1) {
          return a.memGb - b.memGb;
        }
      }
      return 0;
    }

    // Default 'compatibility'
    const scoreMap = (s: MemoryFitStatus) => {
      if (s === 'runs_well') return 0;
      if (s === 'tight' || s === 'slow') return 1;
      if (s === 'unknown') return 2;
      return 3;
    };
    return scoreMap(a.fit.status) - scoreMap(b.fit.status);
  });

  return evaluated.map(e => e.model);
}

/**
 * Backward compatibility helper for sorting by Mac compatibility.
 */
export function sortModelsByMacCompatibility<T extends { id: string; size?: string; note?: string; tags?: string[] }>(
  models: T[],
  macSpecs: MacHardwareSpecs | null,
  readmeCache: Record<string, string> = {}
): T[] {
  return sortModelsByMacMemory(models, macSpecs, readmeCache, 'compatibility');
}
