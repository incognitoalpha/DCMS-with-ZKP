"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcSigner,
  Eip1193Provider,
  InterfaceAbi,
  getAddress,
} from "ethers";
import dcmsArtifact from "./contract/DCMS.json";
import dcmsAddress from "./contract/address.json";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

type WalletState = {
  address: string | null;
  adminAddress: string | null;
  chainId: number | null;
  isAdmin: boolean;
  connecting: boolean;
  error: string | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  contract: Contract | null;
  contractAddress: string;
  expectedChainId: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshAdmin: () => Promise<void>;
};

const WalletCtx = createContext<WalletState | null>(null);

const EXPECTED_CHAIN_ID: number = (dcmsAddress as { chainId: number }).chainId;
const CONTRACT_ADDRESS: string = (dcmsAddress as { address: string }).address;
const CONTRACT_ABI = (dcmsArtifact as { abi: InterfaceAbi }).abi;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildContract = useCallback(
    async (
      eth: Eip1193,
      account?: string
    ): Promise<{ p: BrowserProvider; s: JsonRpcSigner; c: Contract }> => {
      const p = new BrowserProvider(eth as unknown as Eip1193Provider);
      const s = account ? await p.getSigner(account) : await p.getSigner();
      const c = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s);
      return { p, s, c };
    },
    []
  );

  const refreshAdmin = useCallback(async () => {
    if (!provider) {
      setAdminAddress(null);
      setIsAdmin(false);
      return;
    }
    try {
      const readContract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const adminAddr = getAddress(await readContract.admin());
      setAdminAddress(adminAddr);
      setIsAdmin(address !== null && getAddress(address) === adminAddr);
    } catch {
      setAdminAddress(null);
      setIsAdmin(false);
    }
  }, [provider, address]);

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not found. Please install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const eth = window.ethereum;
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const cidHex = (await eth.request({ method: "eth_chainId" })) as string;
      const cid = parseInt(cidHex, 16);
      const activeAccount = accounts[0] ?? null;
      const { p, s, c } = await buildContract(eth, activeAccount ?? undefined);
      setProvider(p);
      setSigner(s);
      setContract(c);
      setAddress(activeAccount);
      setChainId(cid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  }, [buildContract]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setContract(null);
    setProvider(null);
    setIsAdmin(false);
  }, []);

  // Auto-detect existing connection on load
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0) {
          const cidHex = (await eth.request({ method: "eth_chainId" })) as string;
          const cid = parseInt(cidHex, 16);
          const { p, s, c } = await buildContract(eth, accounts[0]);
          setProvider(p);
          setSigner(s);
          setContract(c);
          setAddress(accounts[0]);
          setChainId(cid);
        }
      } catch {
        /* silent */
      }
    })();
  }, [buildContract]);

  // Listen for wallet/network changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum;
    const handleAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[];
      if (accs.length === 0) {
        disconnect();
      } else {
        (async () => {
          try {
            const { p, s, c } = await buildContract(eth, accs[0]);
            setProvider(p);
            setSigner(s);
            setContract(c);
            setAddress(accs[0]);
          } catch {
            setAddress(accs[0]);
            setSigner(null);
            setContract(null);
            setProvider(null);
            setIsAdmin(false);
          }
        })();
      }
    };
    const handleChain = (...args: unknown[]) => {
      const cidHex = args[0] as string;
      setChainId(parseInt(cidHex, 16));
      // refresh provider/signer
      (async () => {
        try {
          const { p, s, c } = await buildContract(eth);
          setProvider(p);
          setSigner(s);
          setContract(c);
        } catch {
          /* silent */
        }
      })();
    };
    eth.on?.("accountsChanged", handleAccounts);
    eth.on?.("chainChanged", handleChain);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
      eth.removeListener?.("chainChanged", handleChain);
    };
  }, [buildContract, disconnect]);

  // Refresh admin state when contract or address changes
  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      isAdmin,
      connecting,
      error,
      adminAddress,
      provider,
      signer,
      contract,
      contractAddress: CONTRACT_ADDRESS,
      expectedChainId: EXPECTED_CHAIN_ID,
      connect,
      disconnect,
      refreshAdmin,
    }),
    [address, adminAddress, chainId, isAdmin, connecting, error, provider, signer, contract, connect, disconnect, refreshAdmin]
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function shortAddr(addr?: string | null): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
