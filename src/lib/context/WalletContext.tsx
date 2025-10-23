"use client";

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { toast } from "sonner";
import { Buffer } from "buffer";

interface WalletContextType {
  walletAddress: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  balance: number | null;
  getPublicKey: () => Promise<Buffer | null>;
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  balance: null,
  getPublicKey: async () => null,
});

export const WalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Initialize state from localStorage
  const [walletAddress, setWalletAddress] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem("walletAddress") : null
  );
  const [isConnected, setIsConnected] = useState(!!walletAddress);
  const [balance, setBalance] = useState<number | null>(null);

  // Auto-reconnect on mount
  useEffect(() => {
    const autoConnect = async () => {
      if (walletAddress && window.unisat) {
        try {
          const accounts = await window.unisat.getAccounts();
          if (accounts.includes(walletAddress)) {
            await window.unisat.switchNetwork("testnet");
            const accounts = await window.unisat.requestAccounts();
            const signetAddress = accounts[0];
            console.log(signetAddress, "signetAddress");
            setWalletAddress(signetAddress);

            const walletBalance = await window.unisat.getBalance();
            setBalance(walletBalance.total);
            setIsConnected(true);
          } else {
            // Stored address no longer valid
            localStorage.removeItem("walletAddress");
            setWalletAddress(null);
            setIsConnected(false);
          }
        } catch (error) {
          console.error("Auto-connect failed:", error);
          localStorage.removeItem("walletAddress");
          setWalletAddress(null);
          setIsConnected(false);
        }
      }
    };

    autoConnect();
  }, [walletAddress]);

  const connect = async () => {
    if (!window.unisat) {
      window.open("https://unisat.io", "_blank");
      return;
    }

    try {
      const accounts = await window.unisat.requestAccounts();
      if (!accounts.length) return;

      await window.unisat.switchNetwork("testnet");
      const walletBalance = await window.unisat.getBalance();

      setWalletAddress(accounts[0]);
      localStorage.setItem("walletAddress", accounts[0]);
      setBalance(walletBalance.total);
      setIsConnected(true);
      toast.success("Wallet connected");
    } catch (error) {
      console.error("Connection failed:", error);
      toast.error("Failed to connect wallet");
    }
  };

  const disconnect = () => {
    localStorage.removeItem("walletAddress");
    setWalletAddress(null);
    setBalance(null);
    setIsConnected(false);
    toast.success("Wallet disconnected");
  };

  const getPublicKey = async () => {
    if (!window.unisat || !isConnected) {
      toast.error("Wallet not connected");
      return null;
    }

    try {
      // UniSat wallet provides public key through this method
      const publicKeyHex = await window.unisat.getPublicKey();
      // Convert hex to Buffer, but only if publicKeyHex is not null
      return publicKeyHex ? Buffer.from(publicKeyHex, "hex") : null;
    } catch (error) {
      console.error("Failed to get public key:", error);
      toast.error("Failed to retrieve public key");
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected,
        connect,
        disconnect,
        balance,
        getPublicKey,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useBtcWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};