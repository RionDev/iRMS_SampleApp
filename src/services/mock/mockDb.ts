// UI 단독 개발용 mock 데이터셋.
// 시드 고정 PRNG 로 세션 간 동일한 데이터를 생성한다 (register_date 만 로드 시점 기준 최근 90일 분산).
// 계약 근거: iRMS_BE/docs/plan/vt-sample-service.md — BE 가 뜨면 VITE_USE_MOCK 을 끄고 제거 대상.

import type {
  FilterMeta,
  FilterOption,
  SampleDetail,
  SampleDiagnosis,
} from '../../types/sample';

// ---------------------------------------------------------------------------
// PRNG (mulberry32) — 시드 고정
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260819);

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randHex(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += '0123456789abcdef'[Math.floor(rand() * 16)];
  }
  return out;
}

// ---------------------------------------------------------------------------
// lookup/dict — photon-db seed 와 동일한 id 체계 (locale 은 2자리 label 표기 가정)
// ---------------------------------------------------------------------------

export const POOLS: FilterOption[] = [
  { id: 1, name: 'Black' },
  { id: 2, name: 'Gray' },
];

export const FORMATS: FilterOption[] = [
  { id: 0, name: 'Unknown' },
  { id: 1, name: 'PE32' },
  { id: 2, name: 'PE64' },
  { id: 7, name: 'ELF32' },
  { id: 8, name: 'ELF64' },
  { id: 11, name: 'MSDOS' },
  { id: 15, name: 'Binary' },
  { id: 16, name: 'Text' },
];

export const CATEGORIES: FilterOption[] = [
  { id: 0, name: 'Unknown' },
  { id: 1, name: 'Archive' },
  { id: 3, name: 'Document' },
  { id: 6, name: 'Image' },
  { id: 8, name: 'Packer' },
  { id: 11, name: 'Installer' },
  { id: 15, name: 'SFX' },
  { id: 16, name: 'Script' },
];

export const LOCALES: FilterOption[] = [
  { id: 0, name: '??' },
  { id: 48, name: 'CN' },
  { id: 114, name: 'JP' },
  { id: 122, name: 'KR' },
  { id: 191, name: 'RU' },
  { id: 233, name: 'US' },
  { id: 30, name: 'BR' },
  { id: 65, name: 'DE' },
  { id: 106, name: 'IN' },
  { id: 240, name: 'VN' },
];

export const SOURCES: FilterOption[] = [
  { id: 0, name: 'Unknown' },
  { id: 1, name: 'VirusTotal' },
  { id: 2, name: 'MalwareBazaar' },
  { id: 3, name: 'VirusShare' },
  { id: 8, name: 'INCA' },
  { id: 12, name: 'Email' },
  { id: 20, name: 'C-TAS' },
];

export const VENDORS: FilterOption[] = [
  { id: 1, name: 'AhnLab' },
  { id: 2, name: 'Kaspersky' },
  { id: 3, name: 'BitDefender' },
  { id: 4, name: 'Microsoft' },
  { id: 5, name: 'ClamAV' },
];

const TAG_NAMES = [
  'ransomware', 'trojan', 'stealer', 'downloader', 'dropper', 'backdoor',
  'keylogger', 'miner', 'botnet', 'rat', 'phishing', 'adware', 'spyware',
  'worm', 'rootkit', 'exploit', 'packed', 'upx', 'obfuscated', 'apt',
  'emotet', 'lockbit', 'qakbot', 'agenttesla',
];

const LABEL_NAMES = [
  'trojan', 'ransomware', 'pua', 'adware', 'downloader', 'banker',
  'worm', 'virus', 'backdoor', 'miner',
];

export const TAGS: FilterOption[] = TAG_NAMES.map((name, i) => ({ id: i + 1, name }));
export const LABELS: FilterOption[] = LABEL_NAMES.map((name, i) => ({ id: i + 1, name }));

// 파일 타입 세부 사전 — null 은 "값 없는 샘플" 생성용 (FILTER_META 에는 미포함)
const SPECTYPES = ['Unknown', '7z', 'Zip', 'NSIS Archive', 'PDF', 'MS Word', null];
const COMPILERS = ['Unknown', 'Visual C++ 2019', 'Visual C++ 6.0', 'GCC', 'Delphi', null];
const LINKERS = ['Unknown', 'MS Linker 14', 'MS Linker 6', null];
const LIBRARIES = ['Unknown', '.NET Framework', 'MFC', 'Qt', null];
const CRYPTERS = ['Unknown', 'UPX', 'Themida', 'VMProtect', null, null];
const OVERLAYS = ['Unknown', 'Authenticode', 'ZIP SFX', null, null];
const RESOURCES = ['Unknown', 'RT_ICON', 'RT_VERSION', null];

function toOptions(names: (string | null)[]): FilterOption[] {
  return names
    .filter((name): name is string => name !== null)
    .map((name, i) => ({ id: i + 1, name }));
}

export const FILTER_META: FilterMeta = {
  tags: TAGS,
  labels: LABELS,
  vendors: VENDORS,
  formats: FORMATS,
  categories: CATEGORIES,
  locales: LOCALES,
  sources: SOURCES,
  pools: POOLS,
  spectypes: toOptions(SPECTYPES),
  compilers: toOptions(COMPILERS),
  linkers: toOptions(LINKERS),
  libraries: toOptions(LIBRARIES),
  crypters: toOptions(CRYPTERS),
  overlays: toOptions(OVERLAYS),
  resources: toOptions(RESOURCES),
};

// ---------------------------------------------------------------------------
// 진단명 생성
// ---------------------------------------------------------------------------

const DIAG_FAMILIES = [
  'Trojan', 'Worm', 'Backdoor', 'Ransom', 'Adware', 'Spyware',
  'Downloader', 'Dropper', 'Virus', 'HackTool',
];
const DIAG_PLATFORMS = ['Win32', 'Win64', 'MSIL', 'Script', 'Linux', 'Android'];
const DIAG_NAMES = [
  'Agent', 'Generic', 'Zbot', 'Emotet', 'LockBit', 'Wannacry', 'Conti',
  'Qakbot', 'Formbook', 'AgentTesla', 'Redline', 'Remcos', 'Njrat', 'Gandcrab',
];

function makeDiagname(): string {
  const family = pick(DIAG_FAMILIES);
  const platform = pick(DIAG_PLATFORMS);
  const name = pick(DIAG_NAMES);
  const suffix = String.fromCharCode(97 + randInt(0, 25)) + String.fromCharCode(97 + randInt(0, 25));
  return `${family}.${platform}.${name}.${suffix}`;
}

const DIAGNAME_POOL: string[] = Array.from({ length: 400 }, makeDiagname);

// ---------------------------------------------------------------------------
// 샘플 생성
// ---------------------------------------------------------------------------

const SAMPLE_COUNT = 1337;
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

function makeSample(id: number): SampleDetail {
  const detectRatioSeed = randInt(0, 100);
  const totalCount = randInt(58, 76);
  const detectCount = Math.round((detectRatioSeed / 100) * totalCount);
  const detectRatio = totalCount === 0 ? 0 : Math.round((detectCount / totalCount) * 100);

  // 진단 벤더 수는 진단율과 비례 (5개 벤더 슬롯)
  const vendorDetectCount = Math.round((detectRatio / 100) * VENDORS.length);
  const shuffledVendors = [...VENDORS].sort(() => rand() - 0.5);
  const diagnoses: SampleDiagnosis[] = shuffledVendors
    .slice(0, vendorDetectCount)
    .map((v) => ({ vendor: v.name, diagname: pick(DIAGNAME_POOL) }))
    .sort((a, b) => a.vendor.localeCompare(b.vendor));

  const tagCount = randInt(0, 4);
  const tags = [...new Set(Array.from({ length: tagCount }, () => pick(TAGS).name))];
  const labelCount = randInt(0, 2);
  const labels = [...new Set(Array.from({ length: labelCount }, () => pick(LABELS).name))];

  // 보관 상태: 15% Stored(다운로드 가능) / 10% Moved / 75% None
  const storageRoll = rand();
  const storageStatus = storageRoll < 0.15 ? 'Stored' : storageRoll < 0.25 ? 'Moved' : 'None';

  const registerMs = NOW - Math.floor(rand() * 90 * DAY_MS);
  const fileFormat = pick(FORMATS).name;
  const fileCategory = pick(CATEGORIES).name;

  return {
    id,
    sha256: rand() < 0.97 ? randHex(64) : null,
    md5: randHex(32),
    file_size: randInt(4 * 1024, 48 * 1024 * 1024),
    pool: rand() < 0.7 ? 'Black' : 'Gray',
    format: fileFormat,
    category: fileCategory,
    detect_count: detectCount,
    total_count: totalCount,
    detect_ratio: detectRatio,
    locale: pick(LOCALES).name,
    source: pick(SOURCES).name,
    tags,
    register_date: formatDateTime(registerMs),
    storage_status: storageStatus,
    labels,
    type: {
      format: fileFormat,
      category: fileCategory,
      spectype: pick(SPECTYPES),
      compiler: pick(COMPILERS),
      linker: pick(LINKERS),
      library: pick(LIBRARIES),
      crypter: pick(CRYPTERS),
      overlay: pick(OVERLAYS),
      resource: pick(RESOURCES),
    },
    ssdeep:
      rand() < 0.8
        ? `${3 * (1 << randInt(4, 12))}:${randHex(24)}:${randHex(12)}`
        : null,
    diagnoses,
    downloadable: storageStatus === 'Stored',
  };
}

/** id 오름차순 생성 → 조회는 id DESC (BE cursor 규약과 동일) */
export const SAMPLES: SampleDetail[] = Array.from({ length: SAMPLE_COUNT }, (_, i) =>
  makeSample(i + 1),
);

export const SAMPLES_BY_HASH = new Map<string, SampleDetail>();
for (const s of SAMPLES) {
  if (s.sha256) SAMPLES_BY_HASH.set(s.sha256, s);
  SAMPLES_BY_HASH.set(s.md5, s);
}
