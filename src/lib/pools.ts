import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import equal from "deep-equal"
import { memoize } from "lodash"
import multicall from "./multicall";

type DataType = "address" | "uint256"

interface CallDefine {
  name: string,
  constant?: boolean
  payable?: false,
  stateMutability?: "nonpayable" | "payable",
  type: "function" | "event"
  anonymous?: boolean,
  inputs: { name: string, type: DataType, indexed?: boolean, }[],
  outputs?: { name: string, type: DataType }[],
}

interface Request {
  address: string,
  method: string,
  params: any[],
  callDefine: CallDefine,
  resolve: (e: any) => any,
  reject: (e: any) => any,
}

let poolIdCounter = 0
let poolCount = 0

class Pool {

  constructor(
    public provider: StaticJsonRpcProvider | JsonRpcProvider,
    public networkId: number
  ) { }

  private queue: Request[] = []

  private abiMap: Record<string, CallDefine> = {}

  public id = poolIdCounter++;

  public counter = 0

  public processing = 0

  public pending = 0

  public success = 0

  public callParams: any[] = []

  public maxPools = 100

  public enableArchiveMode = false

  get abi() {
    return Object.values(this.abiMap)
  }

  private addToABI(req: Request): boolean {
    if (!this.abiMap[req.method]) {
      // console.log("[Pool] addToABI", req.method, req.callDefine)

      this.abiMap[req.method] = req.callDefine
      return true
    }
    if (equal(this.abiMap[req.method], req.callDefine)) {
      return true
    }
    return false
  }

  private addToRequestPools(req: Request) {
    // console.log("[Pool] addToRequestPools", req)
    this.queue.push(req)
    this.throttleExecutePool()
  }

  addToPool(req: Request): boolean {
    // console.log("[Pool] addToPool", req)
    if (this.addToABI(req)) {
      this.addToRequestPools(req)
      this.counter++;
      this.pending++;
      return true
    }
    return false
  }

  private async executePool() {
    // console.log("[Pool] executePool")
    const queue = this.queue
    const abi = this.abi
    const poolRunId = (poolCount++) % 1000

    this.queue = []
    this.abiMap = {}
    this.processing += queue.length
    this.pending -= queue.length

    const timeId = `[Pool] [${String(this.id).padStart(2)}] [${String(poolRunId).padStart(3)}] [count:${String(queue.length).padStart(3)}] ${[...new Set<string>(queue.map(e => e.method))]}`

    console.time(timeId)


    const exeMethod = multicall


    try {

      // console.log("[Pool] ABI", { queue, abi })


      const allResult = await exeMethod({ provider: this.provider, networkID: this.networkId })(
        abi,
        queue.map(e => ({
          address: e.address,
          name: e.method,
          params: e.params,
        })),
        // ...this.callParams
      )

      console.timeEnd(timeId)


      queue.forEach((call, index) => {
        try {
          if (allResult[index] instanceof Error) {
            call.reject(allResult[index])
          } else {
            call.resolve(allResult[index])
          }
        } catch (error) {
          console.error(error)
        }
      });

      this.processing -= queue.length
      this.success += queue.length
    } catch (error) {
      queue.forEach((call, index) => {
        try {
          call.reject(error)
        } catch (e) {
          console.error(e)
        }
      });

    }


  }

  _timeout: any

  private throttleExecutePool() {
    if (this.queue.length >= this.maxPools) {
      clearTimeout(this._timeout)
      this.executePool();
    } else {
      clearTimeout(this._timeout)
      this._timeout = setTimeout(
        this.executePool.bind(this),
        20,
      )
    }
  }
}


// const pools: Pool[] = []

const getPools = memoize(
  (networkId) => [] as Pool[],
  (networkId) => String(networkId)
)

const __call = ({ provider, networkID }: { provider: StaticJsonRpcProvider | JsonRpcProvider, networkID: number }) => {

  const pools = getPools(networkID)

  return async function (
    address: string,
    abi: any[],
    method: string,
    params: any[]
  ): Promise<any> {
    const callDefine: CallDefine = abi.find(e => e.type === "function" && e.name === method)

    if (!address)
      throw Promise.reject(new Error("Address is requirered"))

    if (!callDefine)
      throw Promise.reject(new Error(`Method ${method} not found`))

    return new Promise((resolve, reject) => {
      const request: Request = {
        address,
        method,
        params,
        callDefine,
        resolve,
        reject
      }

      if (!pools.some(pool => pool.addToPool(request))) {
        const pool = new Pool(provider, networkID)
        pools.push(pool)
        pool.addToPool(request)
      }

    })

  }
}

const _callMethodWithPool: typeof __call = memoize(
  __call,
  ({ networkID }) => String(networkID)
)

export const callMethodWithPool: typeof __call = memoize(
  ({ provider, networkID }) => {
    return memoize(
      _callMethodWithPool({ provider, networkID }),
      (
        address: string,
        abi: any[],
        method: string,
        params: any[]
      ) => `${address}-${method}-${JSON.stringify(params)}-${(Date.now() / 500) | 0}`
    )
  },
  ({ networkID }) => String(networkID)
)

export const callMethodWithPoolCache: typeof __call = memoize(
  ({ provider, networkID }) => {
    return memoize(
      _callMethodWithPool({ provider, networkID }),
      (
        address: string,
        abi: any[],
        method: string,
        params: any[]
      ) => `${address}-${method}-${JSON.stringify(params)}-${(Date.now() / 100000) | 0}`
    )
  },
  ({ networkID }) => String(networkID)
)


export default callMethodWithPool
