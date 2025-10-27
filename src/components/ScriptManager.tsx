"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useBtcWallet } from "@/lib/context/WalletContext";
import { getTrackedScriptsByWallet, markScriptAsSpent, TrackedScript, formatBalance } from "@/lib/scriptUtils";
import { getUtxos, getTransaction, pushTx } from "@/hooks/api";
import { networks, payments, Psbt, script as bitcoinScript, address, Transaction } from "bitcoinjs-lib";
import { createHash } from "crypto";

interface ScriptUtxo extends TrackedScript {
  utxos: any[];
  balance: number;
  unlockTxid?: string; // Store unlock transaction hash
}

// Helper function to encode witness stack into proper Bitcoin format
function witnessStackToBuffer(stack: Buffer[]): Buffer {
  const buffers: Buffer[] = [];

  // Add witness stack size as varint
  if (stack.length < 0xfd) {
    buffers.push(Buffer.from([stack.length]));
  } else if (stack.length <= 0xffff) {
    buffers.push(Buffer.from([0xfd, stack.length & 0xff, (stack.length >> 8) & 0xff]));
  } else {
    buffers.push(Buffer.from([0xfe, stack.length & 0xff, (stack.length >> 8) & 0xff, (stack.length >> 16) & 0xff, (stack.length >> 24) & 0xff]));
  }

  // Add each stack element with compact size prefix
  for (const element of stack) {
    if (element.length < 0xfd) {
      buffers.push(Buffer.from([element.length]));
    } else if (element.length <= 0xffff) {
      buffers.push(Buffer.from([0xfd, element.length & 0xff, (element.length >> 8) & 0xff]));
    } else {
      buffers.push(Buffer.from([0xfe, element.length & 0xff, (element.length >> 8) & 0xff, (element.length >> 16) & 0xff, (element.length >> 24) & 0xff]));
    }
    buffers.push(element);
  }

  return Buffer.concat(buffers);
}

export default function ScriptManager() {
  const { walletAddress, isConnected, getPublicKey } = useBtcWallet();
  const [scriptUtxos, setScriptUtxos] = useState<ScriptUtxo[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlockingScript, setUnlockingScript] = useState<string | null>(null);

  // Load tracked scripts and check for UTXOs
  const loadScripts = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      const trackedScripts = getTrackedScriptsByWallet(walletAddress);

      const scriptUtxoPromises = trackedScripts.map(async (script) => {
        try {
          const utxos = await getUtxos(script.scriptAddress);
          const balance = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);

          return {
            ...script,
            utxos: utxos || [],
            balance,
          };
        } catch (error) {
          console.error(`Error fetching UTXOs for ${script.scriptAddress}:`, error);
          return {
            ...script,
            utxos: [],
            balance: 0,
          };
        }
      });

      const results = await Promise.all(scriptUtxoPromises);

      // Sort scripts: unspent/available first, then spent
      const sortedResults = results.sort((a, b) => {
        const aHasUtxos = a.utxos.length > 0 && !a.isSpent;
        const bHasUtxos = b.utxos.length > 0 && !b.isSpent;

        // Available scripts first
        if (aHasUtxos && !bHasUtxos) return -1;
        if (!aHasUtxos && bHasUtxos) return 1;

        // Within same category, sort by creation time (newest first)
        return b.createdAt - a.createdAt;
      });

      setScriptUtxos(sortedResults);
    } catch (error) {
      console.error("Error loading scripts:", error);
      toast.error("Failed to load scripts");
    } finally {
      setLoading(false);
    }
  };

  // Unlock/spend from a script address
  const unlockScript = async (script: ScriptUtxo, witnessData: string[]) => {
    if (!walletAddress) {
      toast.error("Wallet not connected");
      return;
    }

    if (script.utxos.length === 0) {
      toast.error("No UTXOs found at this script address");
      return;
    }

    setUnlockingScript(script.id);
    try {
      console.log("Attempting to unlock script:", script.scriptAddress);
      console.log("Witness data provided:", witnessData);

      // Get public key for change output
      const publicKey = await getPublicKey();
      if (!publicKey) {
        throw new Error("Failed to get public key");
      }

      // Recreate the P2WSH payment from the compiled script
      const compiledScript = Buffer.from(script.compiledScript, "hex");
      const p2wsh = payments.p2wsh({
        redeem: { output: compiledScript },
        network: networks.testnet,
      });

      if (!p2wsh.address || p2wsh.address !== script.scriptAddress) {
        throw new Error("Script address mismatch");
      }

      // Create PSBT for spending
      const psbt = new Psbt({ network: networks.testnet });

      // Calculate single UTXO value and required fee (individual unlock, not batch)
      const singleUtxoValue = script.utxos[0]?.value || 0;
      const estimatedFee = 1500; // Conservative fee estimate

      // Add only the first UTXO (individual unlock, not batch)
      const utxoToUnlock = script.utxos[0]; // Unlock just one UTXO

      psbt.addInput({
        hash: utxoToUnlock.txid,
        index: utxoToUnlock.vout,
        witnessUtxo: {
          script: p2wsh.output!,
          value: BigInt(utxoToUnlock.value),
        },
        witnessScript: compiledScript,
      });

      let totalInput = singleUtxoValue;
      let walletUtxosNeeded = 0;

      // Check if we need additional UTXOs from wallet to cover fee or prevent dust output
      const minRelayFee = 300;
      const actualMinFee = Math.max(estimatedFee, minRelayFee);
      const wouldBeOutput = singleUtxoValue - actualMinFee;
      const needsWalletSponsorship = singleUtxoValue < actualMinFee || wouldBeOutput < 546;

      if (needsWalletSponsorship) {
        // Get wallet UTXOs to cover the fee
        const walletUtxos = await getUtxos(walletAddress);
        if (!walletUtxos || walletUtxos.length === 0) {
          throw new Error("No wallet UTXOs available to cover transaction fee");
        }

        // Select wallet UTXOs to cover the fee (so script value can be fully returned)
        const shortfall = actualMinFee + 546; // Fee + minimum output for dust protection

        for (const walletUtxo of walletUtxos) {
          if (walletUtxosNeeded >= shortfall) break;

          // Fetch actual output script for this wallet UTXO
          const ESPLORA_BASE = (process.env.NEXT_PUBLIC_BTC_ESPLORA_API || "https://signet.surge.dev/api").replace(/\/$/, "");
          const txUrl = `${ESPLORA_BASE}/tx/${walletUtxo.txid}`;

          const txResponse = await fetch(txUrl);
          if (!txResponse.ok) {
            continue;
          }

          const txData = await txResponse.json();
          if (!txData.vout || !txData.vout[walletUtxo.vout]) {
            continue;
          }

          const actualOutputScript = Buffer.from(txData.vout[walletUtxo.vout].scriptpubkey, "hex");

          psbt.addInput({
            hash: walletUtxo.txid,
            index: walletUtxo.vout,
            witnessUtxo: {
              script: actualOutputScript,
              value: BigInt(walletUtxo.value),
            },
          });

          totalInput += walletUtxo.value;
          walletUtxosNeeded += walletUtxo.value;
        }

        if (totalInput < singleUtxoValue + estimatedFee) {
          throw new Error(`Insufficient funds: need ${singleUtxoValue + estimatedFee} sats, have ${totalInput} sats`);
        }
      }

      // Calculate proper outputs and fee (use the minRelayFee from above)
      const actualFee = Math.max(estimatedFee, minRelayFee);

      // If wallet is sponsoring the fee, return full script value + wallet change
      // If no wallet sponsorship, deduct fee from script value (already validated above)
      let finalOutput: number;

      if (walletUtxosNeeded > 0) {
        // Wallet is sponsoring the fee, so return full single UTXO value + any wallet change
        const walletChange = totalInput - singleUtxoValue - actualFee;
        finalOutput = singleUtxoValue + Math.max(0, walletChange);
      } else {
        // No wallet sponsorship, fee comes from single UTXO funds (validated to not create dust)
        finalOutput = singleUtxoValue - actualFee;
      }

      const actualUsedFee = totalInput - finalOutput;

      if (finalOutput < 546) {
        throw new Error(`Output too small (${finalOutput} sats). Need at least 546 sats for dust threshold.`);
      }

      if (actualUsedFee < minRelayFee) {
        throw new Error(`Fee too low (${actualUsedFee} sats). Network requires minimum ${minRelayFee} sats.`);
      }

      // Add output to send funds to wallet
      psbt.addOutput({
        address: walletAddress,
        value: BigInt(finalOutput),
      });

      // Convert witness data to proper format
      const witnessStackData = witnessData.map((item) => {
        if (item.startsWith("0x")) {
          const buffer = Buffer.from(item.slice(2), "hex");
          return buffer;
        } else if (item === "OP_TRUE" || item === "1") {
          return Buffer.from([0x01]); // TRUE is 0x01, not 0x51
        } else if (item === "OP_FALSE" || item === "0") {
          return Buffer.from([]);
        } else if (item.match(/^\d+$/)) {
          const num = parseInt(item);
          const encoded = bitcoinScript.number.encode(num);
          const buffer = Buffer.from(encoded);
          return buffer;
        } else {
          // Try as UTF-8 string first (common for hash preimages like "hello")
          const buffer = Buffer.from(item, "utf8");
          return buffer;
        }
      });

      // Determine if this script needs signatures or not
      const scriptNeedsSignatures = script.originalScript.includes("OP_CHECKSIG") || script.originalScript.includes("OP_CHECKMULTISIG") || script.originalScript.includes("OP_CHECKDATASIG");

      let finalPsbt: Psbt;

      // Always sign if we have wallet UTXOs OR if the script needs signatures
      const needsWalletSigning = walletUtxosNeeded > 0 || scriptNeedsSignatures;

      if (needsWalletSigning) {
        if (!window.unisat) {
          throw new Error("UniSat wallet not available");
        }

        const signedPsbtHex = await window.unisat.signPsbt(psbt.toHex());
        finalPsbt = Psbt.fromHex(signedPsbtHex);
      } else {
        finalPsbt = psbt;
      }

      // Process witness data for the single script input only (input 0)

      const scriptInputIndex = 0; // Only process the first (and only) script input

      try {
        // Build witness stack: [witness_data..., witness_script]
        const witnessStack = [...witnessStackData, Buffer.from(compiledScript)];

        // Try using setWitness if it exists, otherwise use finalizeInput
        if (typeof (finalPsbt as any).setWitness === "function") {
          (finalPsbt as any).setWitness(scriptInputIndex, witnessStack);
        } else {
          finalPsbt.finalizeInput(scriptInputIndex, (inputIndex: number, input: any) => {
            // Create witness stack with proper Bitcoin encoding
            const witnessBuffer = Buffer.concat([Buffer.from([witnessStack.length]), ...witnessStack.map((item) => Buffer.concat([item.length < 253 ? Buffer.from([item.length]) : Buffer.from([253, item.length & 0xff, (item.length >> 8) & 0xff]), item]))]);

            return {
              finalScriptWitness: witnessBuffer,
            };
          });
        }
      } catch (inputError) {
        console.error(`Error processing script input:`, inputError);
        console.error("Full error object:", JSON.stringify(inputError, null, 2));
        throw new Error(`Failed to process script input: ${inputError instanceof Error ? inputError.message : "Unknown error"}`);
      }

      // Extract the final transaction
      let finalTx;

      try {
        finalTx = finalPsbt.extractTransaction();
      } catch (extractError) {
        console.error("Failed to extract transaction:", extractError);

        // Fallback: try creating a new PSBT from scratch with simpler approach
        const simplePsbt = new Psbt({ network: networks.testnet });

        // Add single script input
        simplePsbt.addInput({
          hash: utxoToUnlock.txid,
          index: utxoToUnlock.vout,
          witnessUtxo: {
            script: p2wsh.output!,
            value: BigInt(utxoToUnlock.value),
          },
        });

        // Add wallet inputs if needed - re-fetch them since PSBT structure is complex
        if (walletUtxosNeeded > 0) {
          // Re-fetch wallet UTXOs and add the same ones we used before
          const walletUtxos = await getUtxos(walletAddress);
          let addedWalletValue = 0;
          const shortfall = estimatedFee - singleUtxoValue + 546;

          for (const walletUtxo of walletUtxos) {
            if (addedWalletValue >= shortfall) break;

            // Fetch actual output script for this wallet UTXO
            const ESPLORA_BASE = (process.env.NEXT_PUBLIC_BTC_ESPLORA_API || "https://signet.surge.dev/api").replace(/\/$/, "");
            const txUrl = `${ESPLORA_BASE}/tx/${walletUtxo.txid}`;

            try {
              const txResponse = await fetch(txUrl);
              if (!txResponse.ok) continue;

              const txData = await txResponse.json();
              if (!txData.vout || !txData.vout[walletUtxo.vout]) continue;

              const actualOutputScript = Buffer.from(txData.vout[walletUtxo.vout].scriptpubkey, "hex");

              simplePsbt.addInput({
                hash: walletUtxo.txid,
                index: walletUtxo.vout,
                witnessUtxo: {
                  script: actualOutputScript,
                  value: BigInt(walletUtxo.value),
                },
              });

              addedWalletValue += walletUtxo.value;
            } catch (error) {
              // Silent fallback - skip problematic UTXOs
            }
          }
        }

        // Add output with proper fee calculation (same as main approach)
        const minRelayFee = 300;
        const actualFee = Math.max(estimatedFee, minRelayFee);

        let finalOutput: number;
        if (walletUtxosNeeded > 0) {
          // Wallet sponsoring fee - return full single UTXO value + wallet change
          const fallbackTotalInput = singleUtxoValue + walletUtxosNeeded;
          const walletChange = fallbackTotalInput - singleUtxoValue - actualFee;
          finalOutput = singleUtxoValue + Math.max(0, walletChange);
        } else {
          // Script self-funding (already validated to not create dust)
          finalOutput = singleUtxoValue - actualFee;
        }

        // Calculate actual total input based on what was added to the PSBT
        const fallbackScriptValue = script.utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);
        const fallbackTotalInput = simplePsbt.data.inputs.reduce((sum, input) => {
          return sum + Number(input.witnessUtxo?.value || 0);
        }, 0);
        const fallbackActualFee = fallbackTotalInput - finalOutput;

        if (finalOutput < 546) {
          throw new Error(`Fallback: Output too small (${finalOutput} sats). Need at least 546 sats for dust threshold.`);
        }

        if (fallbackActualFee < minRelayFee) {
          throw new Error(`Fallback: Fee too low (${fallbackActualFee} sats). Network requires minimum ${minRelayFee} sats.`);
        }

        simplePsbt.addOutput({
          address: walletAddress,
          value: BigInt(finalOutput),
        });

        // Manually set witness data for the single script input only
        const witnessStack = [...witnessStackData, Buffer.from(compiledScript)];

        // Update input with witness data directly (only input 0 - the script UTXO)
        const scriptInput = simplePsbt.data.inputs[0];
        scriptInput.finalScriptWitness = Buffer.concat([Buffer.from([witnessStack.length]), ...witnessStack.map((item) => Buffer.concat([Buffer.from([item.length]), item]))]);

        finalTx = simplePsbt.extractTransaction();
      }

      // Broadcast the unlock transaction
      const unlockTxid = await pushTx(finalTx.toHex());
      console.log("🎉 Script unlocked successfully!");
      console.log("📋 Full Transaction Hash:", unlockTxid);
      console.log("🔗 Block Explorer:", `https://signet.surge.dev/tx/${unlockTxid}`);

      // Mark script as spent
      markScriptAsSpent(script.scriptAddress);

      // Show success message with full transaction hash and block explorer link
      const explorerUrl = `https://signet.surge.dev/tx/${unlockTxid}`;
      toast.success(
        <div>
          <div className="font-medium mb-2">🎉 Script Unlocked Successfully!</div>
          <div className="text-xs mb-2">
            <strong>Transaction:</strong>
            <div className="font-mono break-all bg-gray-100 p-1 rounded mt-1">{unlockTxid}</div>
          </div>
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline text-xs">
            🔗 View on Block Explorer
          </a>
        </div>,
        {
          duration: 10000, // Show for 10 seconds
        }
      );

      // Update the script with unlock transaction hash
      setScriptUtxos((prev) => prev.map((s) => (s.scriptAddress === script.scriptAddress ? { ...s, unlockTxid: unlockTxid, isSpent: true } : s)));

      // Reload scripts to update status
      await loadScripts();
    } catch (error) {
      console.error("Error unlocking script:", error);
      toast.error(`Failed to unlock script: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUnlockingScript(null);
    }
  };

  // Load scripts when wallet connects
  useEffect(() => {
    if (isConnected && walletAddress) {
      loadScripts();
    } else {
      setScriptUtxos([]);
    }
  }, [isConnected, walletAddress]);

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">🔐 Script Manager</h3>
          <p className="text-yellow-700">Connect your wallet to view and manage your Bitcoin scripts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🔐 Your Bitcoin Scripts</h3>
          <p className="text-sm text-gray-600">Manage and unlock your created script addresses</p>
        </div>
        <button onClick={loadScripts} disabled={loading} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
          <p className="text-gray-600 mt-2">Loading scripts...</p>
        </div>
      )}

      {!loading && scriptUtxos.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No scripts found</p>
          <p className="text-sm text-gray-500 mt-1">Create your first script using the Script Builder above</p>
        </div>
      )}

      {!loading && scriptUtxos.length > 0 && (
        <div className="space-y-4">
          {scriptUtxos.map((script) => (
            <ScriptCard key={script.id} script={script} onUnlock={unlockScript} isUnlocking={unlockingScript === script.id} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ScriptCardProps {
  script: ScriptUtxo;
  onUnlock: (script: ScriptUtxo, witnessData: string[]) => Promise<void>;
  isUnlocking: boolean;
}

function ScriptCard({ script, onUnlock, isUnlocking }: ScriptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [witnessInputs, setWitnessInputs] = useState<string[]>([""]);
  const [showUnlockForm, setShowUnlockForm] = useState(false);

  const hasUtxos = script.utxos.length > 0;
  const isAvailable = hasUtxos && !script.isSpent; // Available for unlocking
  const isSpent = script.isSpent; // Completely spent
  const isWaiting = !hasUtxos && !script.isSpent; // Waiting for funding

  const addWitnessInput = () => {
    setWitnessInputs([...witnessInputs, ""]);
  };

  const updateWitnessInput = (index: number, value: string) => {
    const newInputs = [...witnessInputs];
    newInputs[index] = value;
    setWitnessInputs(newInputs);
  };

  const removeWitnessInput = (index: number) => {
    if (witnessInputs.length > 1) {
      const newInputs = witnessInputs.filter((_, i) => i !== index);
      setWitnessInputs(newInputs);
    }
  };

  const handleUnlock = async () => {
    const cleanInputs = witnessInputs.filter((input) => input.trim() !== "");
    if (cleanInputs.length === 0) {
      toast.error("Please provide at least one witness input");
      return;
    }

    await onUnlock(script, cleanInputs);
    setShowUnlockForm(false);
    setWitnessInputs([""]);
  };

  return (
    <div className={`border rounded-lg p-4 ${isAvailable ? "border-green-200 bg-green-50" : isSpent ? "border-gray-200 bg-gray-50" : "border-orange-200 bg-orange-50"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isAvailable ? "bg-green-500" : isSpent ? "bg-gray-400" : "bg-orange-500"}`}></div>
          <div>
            <h4 className="font-medium text-gray-900">
              {script.scriptAddress.slice(0, 20)}...{script.scriptAddress.slice(-10)}
            </h4>
            <p className="text-sm text-gray-600">
              Created {new Date(script.createdAt).toLocaleDateString()} • {formatBalance(script.amount)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isAvailable && <div className="text-sm font-medium text-green-700">{formatBalance(script.balance)} available</div>}
          {isSpent && <div className="text-sm font-medium text-gray-500">✓ Spent</div>}
          {isWaiting && <div className="text-sm font-medium text-orange-600">⏳ Waiting for funds</div>}
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-500 hover:text-gray-700">
            {isExpanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h5 className="font-medium text-gray-700 mb-2">Original Script:</h5>
            <pre className="bg-gray-100 p-3 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto">{script.originalScript}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Funding TX:</span>
              <div className="mt-1 font-mono text-xs break-all">{script.fundingTxid}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">UTXOs:</span>
              <div className="mt-1">
                {script.utxos.length} found ({formatBalance(script.balance)} total)
              </div>
            </div>
          </div>

          {/* Show unlock transaction if script was spent */}
          {script.isSpent && script.unlockTxid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h6 className="font-medium text-green-800 mb-2">✅ Unlock Transaction</h6>
                  <div className="text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-mono text-xs break-all bg-white p-2 rounded border flex-1">{script.unlockTxid}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(script.unlockTxid!);
                          toast.success("Transaction hash copied!");
                        }}
                        className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded border"
                        title="Copy transaction hash"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <a href={`https://signet.surge.dev/tx/${script.unlockTxid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 underline text-sm">
                      🔗 View on Block Explorer
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isAvailable && (
            <div className="pt-4 border-t">
              {!showUnlockForm ? (
                <button onClick={() => setShowUnlockForm(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
                  🔓 Unlock Script
                </button>
              ) : (
                <div className="space-y-3">
                  <h5 className="font-medium text-gray-700">Provide Witness Data to Unlock Script:</h5>

                  {/* Debug info */}
                  <div className="text-xs bg-blue-50 p-2 rounded border">
                    <strong>Script Analysis:</strong>
                    <div>Script: {script.originalScript.substring(0, 100)}...</div>
                    <div>Expected hash: {script.originalScript.match(/0x[a-fA-F0-9]{64}/)?.[0] || "Not found"}</div>
                    <div className="mt-1">
                      <strong>Hash Analysis:</strong>
                      {witnessInputs
                        .filter((input) => input.trim())
                        .map((input, idx) => {
                          const trimmed = input.trim();
                          if (!trimmed) return null;

                          let buffer: Buffer;
                          if (trimmed.startsWith("0x")) {
                            buffer = Buffer.from(trimmed.slice(2), "hex");
                          } else {
                            buffer = Buffer.from(trimmed, "utf8");
                          }

                          const sha256Hash = createHash("sha256").update(buffer).digest("hex");
                          const expectedHash = script.originalScript.match(/0x([a-fA-F0-9]{64})/)?.[1]?.toLowerCase();
                          const matches = expectedHash === sha256Hash;

                          return (
                            <div key={idx} className={`p-1 rounded ${matches ? "bg-green-100" : "bg-red-100"}`}>
                              Input "{trimmed}" → SHA256: 0x{sha256Hash} {matches ? "✅" : "❌"}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {witnessInputs.map((input, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input type="text" value={input} onChange={(e) => updateWitnessInput(index, e.target.value)} placeholder={`Witness ${index + 1} (e.g., 0x1234..., hello, 42, OP_TRUE)`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
                      {witnessInputs.length > 1 && (
                        <button onClick={() => removeWitnessInput(index)} className="px-2 py-2 text-red-500 hover:text-red-700">
                          ×
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex items-center space-x-2">
                    <button onClick={addWitnessInput} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm">
                      + Add Input
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <button onClick={handleUnlock} disabled={isUnlocking} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                      {isUnlocking ? "Unlocking..." : "🔓 Unlock Now"}
                    </button>
                    <button
                      onClick={() => {
                        setShowUnlockForm(false);
                        setWitnessInputs([""]);
                      }}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                    <p className="font-medium text-yellow-800 mb-1">💡 Fee Strategy:</p>
                    <p className="text-yellow-700">
                      {(() => {
                        const estimatedFee = Math.max(300, Math.ceil(250 * 1.5)); // Basic fee estimate
                        const wouldBeOutput = script.balance - estimatedFee;
                        const needsWalletSponsorship = script.balance < estimatedFee || wouldBeOutput < 546;

                        return needsWalletSponsorship ? <>🛡️ Wallet will sponsor the transaction fee to protect your script funds. All {formatBalance(script.balance)} will be returned to you.</> : <>Transaction fee (~300-1500 sats) will be deducted from the script funds ({formatBalance(script.balance)}).</>;
                      })()}
                    </p>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>
                      <strong>Tips:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>
                        Hash preimages: <code>hello</code> (for hash locks)
                      </li>
                      <li>
                        Numbers: <code>42</code> or <code>OP_TRUE</code>
                      </li>
                      <li>
                        Hex data: <code>0x1234abcd</code>
                      </li>
                      <li>Signatures will be added automatically by your wallet</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
