import { Interface } from '@ethersproject/abi'
import MultiCallAbi from "src/abi/Multicall.json";
import { Contract, ContractInterface } from "ethers"
import { JsonRpcProvider, StaticJsonRpcProvider } from '@ethersproject/providers'
import { addresses } from 'src/constants';

interface Call {
  address: string // Address of the contract
  name: string // Function name on the contract (exemple: balanceOf)
  params?: any[] // Function params
}

const multicall = ({ provider, networkID }: { provider: StaticJsonRpcProvider | JsonRpcProvider, networkID: number }) => async (abi: any[], calls: Call[]) => {

  const multi = new Contract(addresses[networkID].MULTICALL, (MultiCallAbi as unknown) as ContractInterface, provider)
  const itf = new Interface(abi)

  const calldata = calls.map((call) => [call.address.toLowerCase(), itf.encodeFunctionData(call.name, call.params)])
  const { returnData, blockNumber } = await multi.callStatic.aggregate(calldata)

  const res = returnData.map((call: any, i: number) => {
    try {
      return itf.decodeFunctionResult(calls[i].name, call)
    } catch (error) {
      console.error(calls[i].name, call)
      return new Error(String(error))
    }
  })
  return res
}

export default multicall

