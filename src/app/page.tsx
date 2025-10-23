"use client";

import { useBtcWallet } from "@/lib/context/WalletContext";
import ScriptBuilder from "@/components/ScriptBuilder";

export default function Home() {
  const { isConnected, connect, disconnect, walletAddress } = useBtcWallet();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Safe for Bitcoin</h1>
              <p className="text-sm text-gray-500">Tap into Bitcoin Safe</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isConnected && walletAddress && (
              <div className="text-sm text-gray-600">
                {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} • p2tr`}
              </div>
            )}
            {isConnected && (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
              >
                Disconnect
              </button>
            )}
            {!isConnected && (
              <button
                onClick={connect}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        {isConnected && <ScriptBuilder />}
        
        {!isConnected && (
          <div className="max-w-2xl mx-auto text-center py-16">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Bitcoin Script Builder
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Create and broadcast custom Bitcoin script transactions on testnet
            </p>
            <button
              onClick={connect}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
            >
              Connect UniSat Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}