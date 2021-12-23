import { ethers, BigNumber, BigNumberish } from "ethers";
import { contractForRedeemHelper } from "../helpers";
import { getBalances, calculateUserBondDetails } from "./AccountSlice";
import { findOrLoadMarketPrice } from "./AppSlice";
import { error, info } from "./MessagesSlice";
import { clearPendingTxn, fetchPendingTxns } from "./PendingTxnsSlice";
import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import { getBondCalculator } from "src/helpers/BondCalculator";
import { abi as BondCalcContractABI } from "src/abi/BondCalcContract.json";

import { RootState } from "src/store";
import {
  IApproveBondAsyncThunk,
  IBondAssetAsyncThunk,
  ICalcBondDetailsAsyncThunk,
  IJsonRPCError,
  IRedeemAllBondsAsyncThunk,
  IRedeemBondAsyncThunk,
} from "./interfaces";
import { segmentUA } from "../helpers/userAnalyticHelpers";
import callMethodWithPool from "src/lib/pools";
import { addresses } from "src/constants";

export const changeApproval = createAsyncThunk(
  "bonding/changeApproval",
  async ({ address, bond, provider, networkID }: IApproveBondAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error("Please connect your wallet!"));
      return;
    }

    const signer = provider.getSigner();
    const reserveContract = bond.getContractForReserve(networkID, signer);
    const bondAddr = bond.getAddressForBond(networkID);

    let approveTx;
    let bondAllowance = await reserveContract.allowance(address, bondAddr);

    // return early if approval already exists
    if (bondAllowance.gt(BigNumber.from("0"))) {
      dispatch(info("Approval completed."));
      dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));
      return;
    }

    try {
      approveTx = await reserveContract.approve(bondAddr, ethers.utils.parseUnits("1000000000", "ether").toString());
      dispatch(
        fetchPendingTxns({
          txnHash: approveTx.hash,
          text: "Approving " + bond.displayName,
          type: "approve_" + bond.name,
        }),
      );
      await approveTx.wait();
    } catch (e: unknown) {
      dispatch(error((e as IJsonRPCError).message));
    } finally {
      if (approveTx) {
        dispatch(clearPendingTxn(approveTx.hash));
        dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));
      }
    }
  },
);

export interface IBondDetails {
  bond: string;
  bondDiscount: number;
  debtRatio: number;
  bondQuote: number;
  purchased: number;
  vestingTerm: number;
  maxBondPrice: number;
  bondPrice: number;
  marketPrice: number;
}
export const calcBondDetails = createAsyncThunk(
  "bonding/calcBondDetails",
  async ({ bond, value, provider, networkID }: ICalcBondDetailsAsyncThunk, { dispatch }): Promise<IBondDetails> => {
    if (!value || value === "") {
      value = "0";
    }
    const amountInWei = ethers.utils.parseEther(value);

    let bondDiscount = 0

    const bondAddress = bond.getAddressForBond(networkID)
    const bondCalcContractAddress = addresses[networkID].BONDINGCALC_ADDRESS;
    const poolCall = callMethodWithPool({ provider, networkID })
    let [
      terms,
      maxPayout,
      debtRatio,
      bondPrice,
      purchased,
      marketPrice,
      bondQuote,
    ] = await Promise.all([
      poolCall(bondAddress, <any>bond.bondContractABI, "terms", []),// bondContract.terms(),
      poolCall(bondAddress, <any>bond.bondContractABI, "maxPayout", []).then(e => e[0]),// bondContract.maxPayout(),
      poolCall(bondAddress, <any>bond.bondContractABI, "standardizedDebtRatio", []).then(e => e[0]),// bondContract.standardizedDebtRatio().then(e => +e / 1e9),
      poolCall(bondAddress, <any>bond.bondContractABI, "bondPriceInUSD", []).then(e => e[0]),// bondContract.bondPriceInUSD(),
      bond.getTreasuryBalance(networkID, provider),
      dispatch(findOrLoadMarketPrice({ networkID: networkID, provider: provider }))
        .unwrap().then(e => e?.marketPrice),
      Number(value) && (
        bond.isLP
          ? poolCall(bondCalcContractAddress, <any>BondCalcContractABI, "valuation", [bond.getAddressForReserve(networkID), amountInWei])
            .then(([valuation]) => poolCall(bondAddress, <any>bond.bondContractABI, "payoutFor", [valuation]))
            .then(e => +e[0] / 1e9)
          : poolCall(bondAddress, <any>bond.bondContractABI, "payoutFor", [amountInWei])
            .then(e => +e[0] / 1e18)
      ) || Promise.resolve(0)
    ])

    if (!amountInWei.isZero() && bondQuote < 0.0001) {
      dispatch(error("Amount is too small!"));
    } else if (!amountInWei.isZero() && bondQuote > (+maxPayout / 1e9)) {
      dispatch(error(`
      You're trying to bond more than the maximum payout available! 
      The maximum bond payout is ${(Number(maxPayout.toString()) / Math.pow(10, 9)).toFixed(2).toString()} BTE
      `));
    }

    bondDiscount = (marketPrice * Math.pow(10, 18) - Number(bondPrice.toString())) / Number(bondPrice.toString()); // 1 - bondPrice / (bondPrice * Math.pow(10, 9));

    return {
      bond: bond.name,
      bondDiscount: bondDiscount,
      debtRatio: Number(debtRatio.toString()),
      bondQuote: Number(bondQuote.toString()),
      purchased,
      vestingTerm: Number(terms.vestingTerm.toString()),
      maxBondPrice: Number(maxPayout.toString()) / Math.pow(10, 9),
      bondPrice: Number(bondPrice.toString()) / Math.pow(10, 18),
      marketPrice: marketPrice,
    };
  },
);

export const bondAsset = createAsyncThunk(
  "bonding/bondAsset",
  async ({ value, address, bond, networkID, provider, slippage }: IBondAssetAsyncThunk, { dispatch }) => {
    const depositorAddress = address;
    const acceptedSlippage = slippage / 100 || 0.005; // 0.5% as default
    // parseUnits takes String => BigNumber
    const valueInWei = ethers.utils.parseUnits(value.toString(), "ether");
    let balance;
    // Calculate maxPremium based on premium and slippage.
    // const calculatePremium = await bonding.calculatePremium();
    const signer = provider.getSigner();
    const bondContract = bond.getContractForBond(networkID, signer);
    const calculatePremium = await bondContract.bondPrice();
    const maxPremium = Math.round(Number(calculatePremium.toString()) * (1 + acceptedSlippage));

    // Deposit the bond
    let bondTx;
    let uaData = {
      address: address,
      value: value,
      type: "Bond",
      bondName: bond.displayName,
      approved: true,
      txHash: "",
    };
    try {
      bondTx = await bondContract.deposit(valueInWei, maxPremium, depositorAddress);
      dispatch(
        fetchPendingTxns({ txnHash: bondTx.hash, text: "Bonding " + bond.displayName, type: "bond_" + bond.name }),
      );
      uaData.txHash = bondTx.hash;
      await bondTx.wait();
      // TODO: it may make more sense to only have it in the finally.
      // UX preference (show pending after txn complete or after balance updated)

      dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));
    } catch (e: unknown) {
      const rpcError = e as IJsonRPCError;
      if (rpcError.code === -32603 && rpcError.message.indexOf("ds-math-sub-underflow") >= 0) {
        dispatch(
          error("You may be trying to bond more than your balance! Error code: 32603. Message: ds-math-sub-underflow"),
        );
      } else dispatch(error(rpcError.message));
    } finally {
      if (bondTx) {
        segmentUA(uaData);
        dispatch(clearPendingTxn(bondTx.hash));
      }
    }
  },
);

export const redeemBond = createAsyncThunk(
  "bonding/redeemBond",
  async ({ address, bond, networkID, provider, autostake }: IRedeemBondAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error("Please connect your wallet!"));
      return;
    }

    const signer = provider.getSigner();
    const bondContract = bond.getContractForBond(networkID, signer);

    let redeemTx;
    let uaData = {
      address: address,
      type: "Redeem",
      bondName: bond.displayName,
      autoStake: autostake,
      approved: true,
      txHash: "",
    };
    try {
      redeemTx = await bondContract.redeem(address, autostake === true);
      const pendingTxnType = "redeem_bond_" + bond + (autostake === true ? "_autostake" : "");
      uaData.txHash = redeemTx.hash;
      dispatch(
        fetchPendingTxns({ txnHash: redeemTx.hash, text: "Redeeming " + bond.displayName, type: pendingTxnType }),
      );

      await redeemTx.wait();
      await dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));

      dispatch(getBalances({ address, networkID, provider }));
    } catch (e: unknown) {
      uaData.approved = false;
      dispatch(error((e as IJsonRPCError).message));
    } finally {
      if (redeemTx) {
        segmentUA(uaData);
        dispatch(clearPendingTxn(redeemTx.hash));
      }
    }
  },
);

export const redeemAllBonds = createAsyncThunk(
  "bonding/redeemAllBonds",
  async ({ bonds, address, networkID, provider, autostake }: IRedeemAllBondsAsyncThunk, { dispatch }) => {
    if (!provider) {
      dispatch(error("Please connect your wallet!"));
      return;
    }

    const signer = provider.getSigner();
    const redeemHelperContract = contractForRedeemHelper({ networkID, provider: signer });

    let redeemAllTx;

    try {
      redeemAllTx = await redeemHelperContract.redeemAll(address, autostake);
      const pendingTxnType = "redeem_all_bonds" + (autostake === true ? "_autostake" : "");

      await dispatch(
        fetchPendingTxns({ txnHash: redeemAllTx.hash, text: "Redeeming All Bonds", type: pendingTxnType }),
      );

      await redeemAllTx.wait();

      bonds &&
        bonds.forEach(async bond => {
          dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));
        });

      dispatch(getBalances({ address, networkID, provider }));
    } catch (e: unknown) {
      dispatch(error((e as IJsonRPCError).message));
    } finally {
      if (redeemAllTx) {
        dispatch(clearPendingTxn(redeemAllTx.hash));
      }
    }
  },
);

// Note(zx): this is a barebones interface for the state. Update to be more accurate
interface IBondSlice {
  status: string;
  [key: string]: any;
}

const setBondState = (state: IBondSlice, payload: any) => {
  const bond = payload.bond;
  const newState = { ...state[bond], ...payload };
  state[bond] = newState;
  state.loading = false;
};

const initialState: IBondSlice = {
  status: "idle",
};

const bondingSlice = createSlice({
  name: "bonding",
  initialState,
  reducers: {
    fetchBondSuccess(state, action) {
      state[action.payload.bond] = action.payload;
    },
  },

  extraReducers: builder => {
    builder
      .addCase(calcBondDetails.pending, state => {
        state.loading = true;
      })
      .addCase(calcBondDetails.fulfilled, (state, action) => {
        setBondState(state, action.payload);
        state.loading = false;
      })
      .addCase(calcBondDetails.rejected, (state, { error }) => {
        state.loading = false;
        console.error(error.message);
      });
  },
});

export default bondingSlice.reducer;

export const { fetchBondSuccess } = bondingSlice.actions;

const baseInfo = (state: RootState) => state.bonding;

export const getBondingState = createSelector(baseInfo, bonding => bonding);
