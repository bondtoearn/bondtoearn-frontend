import { ethers } from "ethers";
import { addresses, REBASE_PER_DAY } from "../constants";
import { abi as OlympusStakingv2ABI } from "../abi/OlympusStakingv2.json";
import { abi as IERC20ABI } from "../abi/IERC20.json";
import { abi as sOHMv2 } from "../abi/sOhmv2.json";
import { abi as TreasuryABI } from "../abi/BondToEarnTreasury.json";
import { setAll, getTokenPrice, getMarketPrice } from "../helpers";
import apollo from "../lib/apolloClient";
import { createSlice, createSelector, createAsyncThunk } from "@reduxjs/toolkit";
import { RootState } from "src/store";
import { IBaseAsyncThunk } from "./interfaces";
import { OlympusStakingv2, SOhmv2, IERC20 } from "../typechain";
import callMethodWithPool from "src/lib/pools";

interface IProtocolMetrics {
  readonly timestamp: string;
  readonly ohmCirculatingSupply: string;
  readonly sOhmCirculatingSupply: string;
  readonly totalSupply: string;
  readonly ohmPrice: string;
  readonly marketCap: string;
  readonly totalValueLocked: string;
  readonly treasuryMarketValue: string;
  readonly nextEpochRebase: string;
  readonly nextDistributedOhm: string;
}

export const loadAppDetails = createAsyncThunk(
  "app/loadAppDetails",
  async ({ networkID, provider }: IBaseAsyncThunk, { dispatch }) => {

    const callPool = callMethodWithPool({ provider, networkID })
    const {
      OHM_ADDRESS,
      TREASURY_ADDRESS,
      STAKING_ADDRESS,
      SOHM_ADDRESS,
    } = addresses[networkID]

    const [
      currentBlock,
      epoch,
      circ,
      totalSupplyRaw,
      totalReservesRaw,
      currentIndexRaw,
      marketPrice,
    ] = await Promise.all([
      provider.getBlockNumber(),
      callPool(STAKING_ADDRESS, OlympusStakingv2ABI, "epoch", []),
      callPool(SOHM_ADDRESS, sOHMv2, "circulatingSupply", []).then(e => e[0]),
      callPool(OHM_ADDRESS, IERC20ABI, "totalSupply", []).then(e => e[0]),
      callPool(TREASURY_ADDRESS, TreasuryABI, "totalReserves", []).then(e => e[0]),
      callPool(STAKING_ADDRESS, OlympusStakingv2ABI, "index", []).then(e => e[0]),
      dispatch(loadMarketPrice({ networkID: networkID, provider: provider }),).unwrap().then(e => e.marketPrice),
    ])

    const stakingReward = epoch.distribute;
    const stakingRebase = +stakingReward / +circ;
    const fiveDayRate = Math.pow(1 + stakingRebase, 5 * REBASE_PER_DAY) - 1;
    const stakingAPY = Math.min(Math.pow(1 + stakingRebase, 365 * REBASE_PER_DAY) - 1, 9999999.9999);

    const totalSupply = +(totalSupplyRaw) / 1e9;

    const circSupply = totalSupply - (+circ / 1e9);
    const marketCap = totalSupply * marketPrice
    const stakingTVL = (+circ / 1e9) * marketPrice
    const treasuryMarketValue = +totalReservesRaw / 1e9;
    const currentIndex = ethers.utils.formatUnits(currentIndexRaw, "gwei")

    return {
      currentIndex,
      currentBlock,
      fiveDayRate,
      stakingAPY,
      stakingTVL,
      stakingRebase,
      marketPrice,
      marketCap,
      circSupply,
      totalSupply,
      treasuryMarketValue,
    } as IAppData;
  },
);

/**
 * checks if app.slice has marketPrice already
 * if yes then simply load that state
 * if no then fetches via `loadMarketPrice`
 *
 * `usage`:
 * ```
 * const originalPromiseResult = await dispatch(
 *    findOrLoadMarketPrice({ networkID: networkID, provider: provider }),
 *  ).unwrap();
 * originalPromiseResult?.whateverValue;
 * ```
 */
export const findOrLoadMarketPrice = createAsyncThunk(
  "app/findOrLoadMarketPrice",
  async ({ networkID, provider }: IBaseAsyncThunk, { dispatch, getState }) => {
    const state: any = getState();
    let marketPrice;
    // check if we already have loaded market price
    if (state.app.loadingMarketPrice === false && state.app.marketPrice) {
      // go get marketPrice from app.state
      marketPrice = state.app.marketPrice;
    } else {
      // we don't have marketPrice in app.state, so go get it
      try {
        const originalPromiseResult = await dispatch(
          loadMarketPrice({ networkID: networkID, provider: provider }),
        ).unwrap();
        marketPrice = originalPromiseResult?.marketPrice;
      } catch (rejectedValueOrSerializedError) {
        // handle error here
        console.error("Returned a null response from dispatch(loadMarketPrice)");
        return;
      }
    }
    return { marketPrice };
  },
);

/**
 * - fetches the OHM price from CoinGecko (via getTokenPrice)
 * - falls back to fetch marketPrice from ohm-dai contract
 * - updates the App.slice when it runs
 */
const loadMarketPrice = createAsyncThunk("app/loadMarketPrice", async ({ networkID, provider }: IBaseAsyncThunk) => {
  let marketPrice: number;
  try {
    marketPrice = await getMarketPrice({ networkID, provider });
    marketPrice = marketPrice / Math.pow(10, 9);
  } catch (e) {
    marketPrice = 100;
    // marketPrice = await getTokenPrice("olympus");
  }
  return { marketPrice };
});

interface IAppData {
  readonly circSupply?: number;
  readonly currentIndex?: string;
  readonly currentBlock?: number;
  readonly fiveDayRate?: number;
  readonly loading: boolean;
  readonly loadingMarketPrice: boolean;
  readonly marketCap?: number;
  readonly marketPrice?: number;
  readonly stakingAPY?: number;
  readonly stakingRebase?: number;
  readonly stakingTVL?: number;
  readonly totalSupply?: number;
  readonly treasuryBalance?: number;
  readonly treasuryMarketValue?: number;
}

const initialState: IAppData = {
  loading: false,
  loadingMarketPrice: false,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    fetchAppSuccess(state, action) {
      setAll(state, action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadAppDetails.pending, state => {
        state.loading = true;
      })
      .addCase(loadAppDetails.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loading = false;
      })
      .addCase(loadAppDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.error(error.name, error.message, error.stack);
      })
      .addCase(loadMarketPrice.pending, (state, action) => {
        state.loadingMarketPrice = true;
      })
      .addCase(loadMarketPrice.fulfilled, (state, action) => {
        setAll(state, action.payload);
        state.loadingMarketPrice = false;
      })
      .addCase(loadMarketPrice.rejected, (state, { error }) => {
        state.loadingMarketPrice = false;
        console.error(error.name, error.message, error.stack);
      });
  },
});

const baseInfo = (state: RootState) => state.app;

export default appSlice.reducer;

export const { fetchAppSuccess } = appSlice.actions;

export const getAppState = createSelector(baseInfo, app => app);
