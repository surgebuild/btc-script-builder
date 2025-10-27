"use client";

import { useBtcWallet } from "@/lib/context/WalletContext";
import ScriptBuilder from "@/components/ScriptBuilder";
import ScriptManager from "@/components/ScriptManager";
import { formatBalance } from "@/lib/scriptUtils";

export default function Home() {
  const { isConnected, connect, disconnect, walletAddress, balance } = useBtcWallet();

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
              <h1 className="text-lg font-semibold text-gray-900">Bitcoin Script Builder Playground</h1>
              <p className="text-sm text-gray-500">Create & Execute Bitcoin Scripts</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isConnected && walletAddress && (
              <div className="flex flex-col items-end">
                <div className="text-sm text-gray-600">{`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} • p2tr`}</div>
                {balance !== null && <div className="text-xs font-medium text-green-600">{formatBalance(balance)}</div>}
              </div>
            )}
            {isConnected && (
              <button onClick={disconnect} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">
                Disconnect
              </button>
            )}
            {!isConnected && (
              <button onClick={connect} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {isConnected ? (
        <div className="flex h-screen bg-gray-50">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Script Builder - Left Side */}
            <div className="flex-1 p-6 overflow-y-auto">
              <ScriptBuilder />
            </div>
          </div>

          {/* Right Sidebar - Script Manager */}
          <div className="w-[540px] bg-white border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ScriptManager />
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-orange-900 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-8 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-xl">₿</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Bitcoin Script Builder</h1>
            <p className="text-gray-300 mb-8">Create, test, and execute custom Bitcoin scripts on testnet</p>
            <button onClick={connect} className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/25">
              Connect UniSat Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
