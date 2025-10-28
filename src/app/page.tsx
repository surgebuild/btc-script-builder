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
        <div className="flex flex-col h-screen bg-gray-50">
          <div className="flex flex-1 overflow-hidden">
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

          {/* Footer for main app */}
          <footer className="bg-white border-t border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <a href="https://github.com/surgebuild/btc-script-builder" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 transition-colors duration-200 flex items-center space-x-1 text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd"></path>
                  </svg>
                  <span>GitHub</span>
                </a>
                <a href="https://x.com/surgebuild" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 transition-colors duration-200 flex items-center space-x-1 text-xs">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.89 9.36L18.74 1h-1.59l-5.94 6.9L6.3 1H1l7.18 10.46L1 21h1.59l6.27-7.29L13.7 21H19l-7.11-11.64zm-2.22 2.58l-.73-1.04L3.34 2.3h2.46l4.69 6.71.73 1.04 6.07 8.67h-2.46l-4.98-7.14z" />
                  </svg>
                  <span>@surgebuild</span>
                </a>
              </div>
              <p className="text-xs text-gray-400">Built with ❤️ by Surge</p>
            </div>
          </footer>
        </div>
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-orange-900 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
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

          {/* Footer for landing page */}
          <footer className="pb-6">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-6 mb-2">
                <a href="https://github.com/surgebuild/btc-script-builder" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors duration-200 flex items-center space-x-1 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd"></path>
                  </svg>
                  <span>GitHub</span>
                </a>
                <a href="https://x.com/surgebuild" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors duration-200 flex items-center space-x-1 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.89 9.36L18.74 1h-1.59l-5.94 6.9L6.3 1H1l7.18 10.46L1 21h1.59l6.27-7.29L13.7 21H19l-7.11-11.64zm-2.22 2.58l-.73-1.04L3.34 2.3h2.46l4.69 6.71.73 1.04 6.07 8.67h-2.46l-4.98-7.14z" />
                  </svg>
                  <span>@surgebuild</span>
                </a>
              </div>
              <p className="text-xs text-gray-500">Built with ❤️ by Surge</p>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
