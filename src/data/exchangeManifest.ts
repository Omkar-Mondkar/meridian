/**
 * Exchange File Manifest Catalog
 * Catalogs ~200 BOD exchange files across NetApp folder structures:
 * - NSE: CASH, CDS, COM, FUTURE, SLBM
 * - BSE: CASH, CDS, FUTURE, SLBM
 * - MCX: COM
 * - CCIL: Fortnightly settlement & clearing masters
 */

export type ExchangeSegment =
  | "NSE_CASH"
  | "NSE_CDS"
  | "NSE_COM"
  | "NSE_FUTURE"
  | "NSE_SLBM"
  | "BSE_CASH"
  | "BSE_CDS"
  | "BSE_FUTURE"
  | "BSE_SLBM"
  | "MCX_COM"
  | "CCIL";

export type ExchangeName = "NSE" | "BSE" | "MCX" | "CCIL";

export type FileCategory =
  | "master"
  | "bhavcopy"
  | "span"
  | "margin"
  | "participant"
  | "settlement"
  | "security_ban";

export interface ExchangeFileItem {
  id: string;
  name: string;
  exchange: ExchangeName;
  segment: ExchangeSegment;
  subfolder: string;
  folderPath: string; // e.g. /netapp/NSE/FUTURE/
  category: FileCategory;
  expectedTime: string;
  status: "downloaded" | "pending" | "failed";
  sizeKb: number;
  downloadedAt?: string;
  isFortnightly?: boolean;
}

export interface FileManifestSummary {
  totalExpected: number;
  downloadedCount: number;
  pendingCount: number;
  failedCount: number;
  files: ExchangeFileItem[];
}

interface SegmentDef {
  exchange: ExchangeName;
  segment: ExchangeSegment;
  subfolder: string;
  templates: Array<{
    pattern: string;
    category: FileCategory;
    sizeKb: number;
    count: number;
    fortnightly?: boolean;
  }>;
}

const SEGMENT_DEFINITIONS: SegmentDef[] = [
  // --- NSE SEGMENTS ---
  {
    exchange: "NSE",
    segment: "NSE_FUTURE",
    subfolder: "FUTURE",
    templates: [
      { pattern: "fo_contract.txt", category: "master", sizeKb: 14200, count: 1 },
      { pattern: "fo_secban.csv", category: "security_ban", sizeKb: 12, count: 1 },
      { pattern: "spancirc.dat", category: "span", sizeKb: 28400, count: 1 },
      { pattern: "nspan.dat", category: "span", sizeKb: 19800, count: 1 },
      { pattern: "fo_elm.csv", category: "margin", sizeKb: 1450, count: 1 },
      { pattern: "fo_bhav.csv", category: "bhavcopy", sizeKb: 6800, count: 1 },
      { pattern: "fo_participant_vol.csv", category: "participant", sizeKb: 340, count: 1 },
      { pattern: "fo_mwpl.csv", category: "master", sizeKb: 420, count: 1 },
      { pattern: "strike_params_%d.dat", category: "master", sizeKb: 890, count: 12 },
      { pattern: "fo_margin_param_%d.csv", category: "margin", sizeKb: 1200, count: 15 },
      { pattern: "fo_position_limit_%d.xml", category: "master", sizeKb: 650, count: 8 },
    ], // ~42 files
  },
  {
    exchange: "NSE",
    segment: "NSE_CASH",
    subfolder: "CASH",
    templates: [
      { pattern: "security.csv", category: "master", sizeKb: 3200, count: 1 },
      { pattern: "cm_bhavcopy.csv", category: "bhavcopy", sizeKb: 4100, count: 1 },
      { pattern: "sec_price_bands.csv", category: "master", sizeKb: 540, count: 1 },
      { pattern: "ind_close_all.csv", category: "bhavcopy", sizeKb: 180, count: 1 },
      { pattern: "cm_var_margin.dat", category: "margin", sizeKb: 8900, count: 1 },
      { pattern: "sec_short_margin.csv", category: "margin", sizeKb: 320, count: 1 },
      { pattern: "cm_category_master_%d.csv", category: "master", sizeKb: 450, count: 10 },
      { pattern: "cm_series_param_%d.dat", category: "master", sizeKb: 620, count: 8 },
      { pattern: "cm_isin_mapping_%d.csv", category: "master", sizeKb: 1100, count: 6 },
    ], // ~30 files
  },
  {
    exchange: "NSE",
    segment: "NSE_CDS",
    subfolder: "CDS",
    templates: [
      { pattern: "cd_contract.txt", category: "master", sizeKb: 2800, count: 1 },
      { pattern: "cd_bhav.csv", category: "bhavcopy", sizeKb: 940, count: 1 },
      { pattern: "cd_spancirc.dat", category: "span", sizeKb: 4500, count: 1 },
      { pattern: "cd_participant.csv", category: "participant", sizeKb: 120, count: 1 },
      { pattern: "cd_tenor_master_%d.csv", category: "master", sizeKb: 310, count: 8 },
      { pattern: "cd_volatility_%d.dat", category: "margin", sizeKb: 580, count: 8 },
      { pattern: "cd_fx_margin_%d.csv", category: "margin", sizeKb: 420, count: 6 },
    ], // ~26 files
  },
  {
    exchange: "NSE",
    segment: "NSE_COM",
    subfolder: "COM",
    templates: [
      { pattern: "nse_com_contract.txt", category: "master", sizeKb: 1800, count: 1 },
      { pattern: "nse_com_bhav.csv", category: "bhavcopy", sizeKb: 450, count: 1 },
      { pattern: "nse_com_span.dat", category: "span", sizeKb: 3200, count: 1 },
      { pattern: "nse_com_vault_master_%d.csv", category: "master", sizeKb: 220, count: 8 },
      { pattern: "nse_com_margins_%d.dat", category: "margin", sizeKb: 410, count: 9 },
    ], // ~20 files
  },
  {
    exchange: "NSE",
    segment: "NSE_SLBM",
    subfolder: "SLBM",
    templates: [
      { pattern: "slb_security.csv", category: "master", sizeKb: 890, count: 1 },
      { pattern: "slb_bhavcopy.csv", category: "bhavcopy", sizeKb: 310, count: 1 },
      { pattern: "slb_settlement_price.csv", category: "settlement", sizeKb: 190, count: 1 },
      { pattern: "slb_lending_fees_%d.dat", category: "margin", sizeKb: 240, count: 12 },
    ], // ~15 files
  },

  // --- BSE SEGMENTS ---
  {
    exchange: "BSE",
    segment: "BSE_CASH",
    subfolder: "CASH",
    templates: [
      { pattern: "bse_scrip_master.txt", category: "master", sizeKb: 4100, count: 1 },
      { pattern: "bse_bhavcopy.csv", category: "bhavcopy", sizeKb: 3200, count: 1 },
      { pattern: "bse_circuit_filter.csv", category: "master", sizeKb: 380, count: 1 },
      { pattern: "bse_var_margin.dat", category: "margin", sizeKb: 5100, count: 1 },
      { pattern: "bse_group_master_%d.csv", category: "master", sizeKb: 290, count: 10 },
      { pattern: "bse_cash_margin_%d.dat", category: "margin", sizeKb: 480, count: 10 },
    ], // ~24 files
  },
  {
    exchange: "BSE",
    segment: "BSE_FUTURE",
    subfolder: "FUTURE",
    templates: [
      { pattern: "bse_fo_contract.txt", category: "master", sizeKb: 2400, count: 1 },
      { pattern: "bse_fo_bhav.csv", category: "bhavcopy", sizeKb: 1100, count: 1 },
      { pattern: "bse_span.dat", category: "span", sizeKb: 6800, count: 1 },
      { pattern: "bse_fo_margin_%d.csv", category: "margin", sizeKb: 380, count: 12 },
      { pattern: "bse_fo_series_%d.dat", category: "master", sizeKb: 290, count: 6 },
    ], // ~21 files
  },
  {
    exchange: "BSE",
    segment: "BSE_CDS",
    subfolder: "CDS",
    templates: [
      { pattern: "bse_cd_contract.txt", category: "master", sizeKb: 1400, count: 1 },
      { pattern: "bse_cd_bhav.csv", category: "bhavcopy", sizeKb: 420, count: 1 },
      { pattern: "bse_cd_span.dat", category: "span", sizeKb: 2900, count: 1 },
      { pattern: "bse_cd_parameters_%d.dat", category: "margin", sizeKb: 310, count: 11 },
    ], // ~14 files
  },
  {
    exchange: "BSE",
    segment: "BSE_SLBM",
    subfolder: "SLBM",
    templates: [
      { pattern: "bse_slb_master.csv", category: "master", sizeKb: 620, count: 1 },
      { pattern: "bse_slb_bhav.csv", category: "bhavcopy", sizeKb: 210, count: 1 },
      { pattern: "bse_slb_rate_%d.dat", category: "settlement", sizeKb: 180, count: 8 },
    ], // ~10 files
  },

  // --- MCX SEGMENT ---
  {
    exchange: "MCX",
    segment: "MCX_COM",
    subfolder: "COM",
    templates: [
      { pattern: "mcx_contract.csv", category: "master", sizeKb: 3600, count: 1 },
      { pattern: "mcx_bhavcopy.csv", category: "bhavcopy", sizeKb: 1450, count: 1 },
      { pattern: "mcx_span.dat", category: "span", sizeKb: 9200, count: 1 },
      { pattern: "mcx_tender_margin.csv", category: "margin", sizeKb: 680, count: 1 },
      { pattern: "mcx_delivery_intent.csv", category: "settlement", sizeKb: 310, count: 1 },
      { pattern: "mcx_commodity_specs_%d.csv", category: "master", sizeKb: 490, count: 10 },
      { pattern: "mcx_daily_margin_%d.dat", category: "margin", sizeKb: 550, count: 10 },
    ], // ~25 files
  },

  // --- CCIL SEGMENT (Fortnightly) ---
  {
    exchange: "CCIL",
    segment: "CCIL",
    subfolder: "SETTLEMENT",
    templates: [
      { pattern: "ccil_fortnightly_settle.csv", category: "settlement", sizeKb: 1200, count: 1, fortnightly: true },
      { pattern: "ccil_clearing_members.dat", category: "participant", sizeKb: 450, count: 1, fortnightly: true },
      { pattern: "ccil_collateral_master.csv", category: "master", sizeKb: 890, count: 1, fortnightly: true },
      { pattern: "ccil_haircut_matrix.dat", category: "margin", sizeKb: 320, count: 1, fortnightly: true },
      { pattern: "ccil_yield_curve_%d.csv", category: "master", sizeKb: 260, count: 2, fortnightly: true },
    ], // 6 files
  },
];

/**
 * Deterministically generates the ~210 BOD files catalog across NetApp directories.
 * ~94% start as downloaded, and ~6% start as pending to simulate live morning ingestion.
 */
export function generateBODExchangeFiles(): FileManifestSummary {
  const files: ExchangeFileItem[] = [];
  let fileIndex = 1;

  for (const segDef of SEGMENT_DEFINITIONS) {
    const folderPath = `/netapp/${segDef.exchange}/${segDef.subfolder}/`;

    for (const tpl of segDef.templates) {
      for (let i = 1; i <= tpl.count; i++) {
        const id = `F-${String(fileIndex).padStart(3, "0")}`;
        const filename = tpl.pattern.includes("%d")
          ? tpl.pattern.replace("%d", String(i).padStart(2, "0"))
          : tpl.pattern;

        // Pending files simulation: make ~10 specific files pending (e.g. late span or margin updates)
        const isLateFile =
          filename.includes("spancirc") ||
          filename.includes("nspan") ||
          filename.includes("margin_param_14") ||
          filename.includes("margin_param_15") ||
          filename.includes("mcx_daily_margin_09") ||
          filename.includes("mcx_daily_margin_10") ||
          filename.includes("bse_cd_parameters_11");

        const status = isLateFile ? "pending" : "downloaded";
        const downloadedAt = status === "downloaded" ? "00:28:14" : undefined;

        files.push({
          id,
          name: filename,
          exchange: segDef.exchange,
          segment: segDef.segment,
          subfolder: segDef.subfolder,
          folderPath,
          category: tpl.category,
          expectedTime: "00:30",
          status,
          sizeKb: tpl.sizeKb,
          downloadedAt,
          isFortnightly: tpl.fortnightly,
        });

        fileIndex++;
      }
    }
  }

  const downloadedCount = files.filter((f) => f.status === "downloaded").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const failedCount = files.filter((f) => f.status === "failed").length;

  return {
    totalExpected: files.length,
    downloadedCount,
    pendingCount,
    failedCount,
    files,
  };
}
