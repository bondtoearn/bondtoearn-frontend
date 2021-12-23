export const THE_GRAPH_URL = "https://api.thegraph.com/subgraphs/name/bondtoearn/bond-to-earn-subgraph";
export const EPOCH_INTERVAL = 9600;

// NOTE could get this from an outside source since it changes slightly over time
export const BLOCK_RATE_SECONDS = 3;
export const REBASE_PER_DAY = 3;

export const TOKEN_DECIMALS = 9;

interface IPoolGraphURLS {
  [index: string]: string;
}

export const POOL_GRAPH_URLS: IPoolGraphURLS = {
  4: "https://api.thegraph.com/subgraphs/name/pooltogether/rinkeby-v3_4_3",
  1: "https://api.thegraph.com/subgraphs/name/pooltogether/pooltogether-v3_4_3",
  // 97: "https://api.thegraph.com/subgraphs/name/pooltogether/pooltogether-v3_4_3",
};

interface IAddresses {
  [key: number]: { [key: string]: string };
}

const checking = (obj: any) => new Proxy(obj, {
  get(target, k) {
    if(!(k in target)){
      console.error(`${String(k)} not in Address`)
      throw new Error(`${String(k)} not in Address`)
    }
    return target[k]
  }
})

export const addresses: IAddresses = {
  56: checking({
    DAI_ADDRESS: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", // duplicate
    OHM_ADDRESS: "0x302Ba80E9D51293B64e833D2879A54E2729e7b17",
    SOHM_ADDRESS: "0x5617c8ca9F43eD02E0Bb6F84833a849afD99AeDd",
    STAKING_ADDRESS: "0xe222F719e941223A5982b3F09545b0D1694c940a", // The new staking contract
    STAKING_HELPER_ADDRESS: "0x85B228E15396730A456A39314c923299fcc30d23", // Helper contract used for Staking only
    REDEEM_HELPER_ADDRESS: "0x6f0eDD443A3Ee2340012F75F637258AA5B4F304D",
    BONDINGCALC_ADDRESS: "0x8b5c420E8AB436c4eca09F8E097fd9dbF18D38EC",
    TREASURY_ADDRESS: "0x006cd9599e28b2242AcfaE62Df76662D044B9a02",
    MULTICALL: "0xc666a70604119B976a36D4faa06c2a36D9108ee0",

  }),
  97: checking({
    DAI_ADDRESS: "0xfBefe17dAbD41E96CD57bDb08AeB2fDdcfA42BB4", // duplicate
    OHM_ADDRESS: "0x7c34853508b1bfA40bFFAf3A9e30cD2Aa82c5DfB",
    STAKING_ADDRESS: "0x2D4Ad8e952D39D49552f6656b2299045A42dcf5B", // The new staking contract
    STAKING_HELPER_ADDRESS: "0xBcb6fE5818d88f5fA80b9634fbe5DeB071d2C15D", // Helper contract used for Staking only
    SOHM_ADDRESS: "0x52EB13B8C4ee19E567E7f05ED55039Febaa437F9",
    // WSOHM_ADDRESS: "0xca76543cf381ebbb277be79574059e32108e3e65",
    // DISTRIBUTOR_ADDRESS: "0xbe731507810C8747C3E01E62c676b1cA6F93242f",
    BONDINGCALC_ADDRESS: "0x0c99cA6D59B3a68461e423a88f65C22fd0CCFA5A",
    TREASURY_ADDRESS: "0x887eF023F52f8AE7A4E5a3fCEAbdCEC68787510f",
    MULTICALL: "0x67ADCB4dF3931b0C5Da724058ADC2174a9844412",

    // CRUCIBLE_OHM_LUSD: "0x2230ad29920D61A535759678191094b74271f373",
    // LQTY: "0x6dea81c8171d0ba574754ef6f8b412f2ed88c54d",
    // MIST: "0x88acdd2a6425c3faae4bc9650fd7e27e0bebb7ab",
    // REDEEM_HELPER_ADDRESS: "0xE1e83825613DE12E8F0502Da939523558f0B819E",
    // FUSE_6_SOHM: "0x59bd6774c22486d9f4fab2d448dce4f892a9ae25", // Tetranode's Locker
    // FUSE_18_SOHM: "0x6eDa4b59BaC787933A4A21b65672539ceF6ec97b", // Olympus Pool Party
    // FUSE_36_SOHM: "0x252d447c54F33e033AD04048baEAdE7628cB1274", // Fraximalist Money Market
    // PT_TOKEN_ADDRESS: "0x0E930b8610229D74Da0A174626138Deb732cE6e9", // 33T token address, taken from `ticket` function on PRIZE_STRATEGY_ADDRESS
    // PT_PRIZE_POOL_ADDRESS: "0xEaB695A8F5a44f583003A8bC97d677880D528248", // NEW
    // PT_PRIZE_STRATEGY_ADDRESS: "0xf3d253257167c935f8C62A02AEaeBB24c9c5012a", // NEW
    // MIGRATOR_ADDRESS: "0x184f3FAd8618a6F458C16bae63F70C426fE784B3",
    // GOHM_ADDRESS: "0x0ab87046fBb341D058F17CBC4c1133F25a20a52f",
  }),
};
