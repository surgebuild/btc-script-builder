import ecc from "@bitcoinerlab/secp256k1";
import { initEccLib, networks, payments, Psbt, script as bitcoinScript, opcodes, address, crypto } from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import { getUtxos, pushTx } from "@/hooks/api";

// Script tracking types
export interface TrackedScript {
  id: string;
  scriptAddress: string;
  originalScript: string;
  compiledScript: string;
  createdAt: number;
  createdBy: string;
  fundingTxid: string;
  amount: number;
  isSpent: boolean;
}

// Initialize ECC library
initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Script tracking functions
const TRACKED_SCRIPTS_KEY = "btc_tracked_scripts";

export function saveTrackedScript(script: TrackedScript): void {
  if (typeof window === "undefined") return;

  const existingScripts = getTrackedScripts();
  const updatedScripts = [...existingScripts, script];

  localStorage.setItem(TRACKED_SCRIPTS_KEY, JSON.stringify(updatedScripts));
  console.log("Saved tracked script:", script.scriptAddress);
}

export function getTrackedScripts(): TrackedScript[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(TRACKED_SCRIPTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading tracked scripts:", error);
    return [];
  }
}

export function getTrackedScriptsByWallet(walletAddress: string): TrackedScript[] {
  return getTrackedScripts().filter((script) => script.createdBy === walletAddress);
}

export function markScriptAsSpent(scriptAddress: string): void {
  if (typeof window === "undefined") return;

  const scripts = getTrackedScripts();
  const updatedScripts = scripts.map((script) => (script.scriptAddress === scriptAddress ? { ...script, isSpent: true } : script));

  localStorage.setItem(TRACKED_SCRIPTS_KEY, JSON.stringify(updatedScripts));
  console.log("Marked script as spent:", scriptAddress);
}

// Utility function to format balance in user-friendly way
export function formatBalance(sats: number): string {
  const BTC_THRESHOLD = 100000; // 0.001 BTC = 100,000 sats

  if (sats >= BTC_THRESHOLD) {
    const btc = sats / 100000000; // Convert to BTC
    return `${btc.toFixed(8).replace(/\.?0+$/, "")} BTC`;
  } else {
    return `${sats.toLocaleString()} sats`;
  }
}

// Utility function to format balance with both units for detailed view
export function formatBalanceDetailed(sats: number): { primary: string; secondary: string } {
  const BTC_THRESHOLD = 100000; // 0.001 BTC = 100,000 sats

  if (sats >= BTC_THRESHOLD) {
    const btc = sats / 100000000;
    return {
      primary: `${btc.toFixed(8).replace(/\.?0+$/, "")} BTC`,
      secondary: `${sats.toLocaleString()} sats`,
    };
  } else {
    const btc = sats / 100000000;
    return {
      primary: `${sats.toLocaleString()} sats`,
      secondary: `${btc.toFixed(8)} BTC`,
    };
  }
}

// Utility function to convert Bitcoin address to hex public key
export function addressToHex(bitcoinAddress: string): string | null {
  try {
    // Remove whitespace and validate format
    const addr = bitcoinAddress.trim();

    if (addr.startsWith("tb1p")) {
      // Taproot address (P2TR) - extract x-only public key
      console.log("Decoding Taproot address:", addr);

      try {
        // Use bitcoinjs-lib to decode the address
        const outputScript = address.toOutputScript(addr, networks.testnet);

        // For P2TR, the output script is: OP_1 <32-byte-pubkey>
        // Script format: [0x51, 0x20, ...32 bytes of pubkey]
        if (outputScript.length === 34 && outputScript[0] === 0x51 && outputScript[1] === 0x20) {
          const xOnlyPubkey = Buffer.from(outputScript.slice(2, 34));
          return `0x${xOnlyPubkey.toString("hex")}`;
        } else {
          console.error("Unexpected Taproot script format");
          return null;
        }
      } catch (error) {
        console.error("Failed to decode Taproot address:", error);
        return null;
      }
    } else if (addr.startsWith("tb1")) {
      // Native SegWit address (P2WPKH) - can't extract public key directly
      console.log("Native SegWit address detected - cannot extract public key from address alone");
      return null;
    } else if (addr.match(/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/)) {
      // Legacy testnet address - can't extract public key directly
      console.log("Legacy address detected - cannot extract public key from address alone");
      return null;
    } else {
      console.log("Unknown address format");
      return null;
    }
  } catch (error) {
    console.error("Error converting address to hex:", error);
    return null;
  }
}

// Function to detect if a string looks like a Bitcoin address
export function isBitcoinAddress(str: string): boolean {
  const trimmed = str.trim();

  // Taproot addresses (tb1p...)
  if (trimmed.match(/^tb1p[a-z0-9]{58}$/)) return true;

  // Native SegWit addresses (tb1...)
  if (trimmed.match(/^tb1[a-z0-9]{39}$/)) return true;

  // Legacy testnet addresses (starts with m, n, or 2)
  if (trimmed.match(/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/)) return true;

  return false;
}

// Improved utility function to select UTXOs (from btc-script-playground)
function selectUtxos(utxos: any[], targetAmount: number) {
  // Sort UTXOs by value in descending order for better selection
  const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);

  const selectedUtxos = [];
  let totalValue = 0;

  for (const utxo of sortedUtxos) {
    if (totalValue >= targetAmount) {
      break;
    }
    selectedUtxos.push(utxo);
    totalValue += utxo.value;
  }

  if (totalValue < targetAmount) {
    throw new Error("Insufficient UTXOs to cover the target amount");
  }

  return { selectedUtxos, totalValue };
}

// Function to parse and compile script from text
function parseScript(scriptText: string): Buffer {
  console.log("Parsing script text:", scriptText);

  const lines = scriptText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
  console.log("Parsed lines:", lines);

  const scriptElements: (number | Buffer)[] = [];

  for (const line of lines) {
    console.log("Processing line:", line);

    if (line.startsWith("OP_")) {
      // Handle opcodes
      const opcodeName = line as keyof typeof opcodes;
      if (opcodes[opcodeName] !== undefined) {
        console.log("Adding opcode:", opcodeName, "=", opcodes[opcodeName]);
        scriptElements.push(opcodes[opcodeName]);
      } else {
        throw new Error(`Unknown opcode: ${line}`);
      }
    } else if (line.startsWith("0x")) {
      // Handle hex data
      const hexData = line.slice(2);
      if (hexData.length % 2 !== 0) {
        throw new Error(`Invalid hex data: ${line}`);
      }
      console.log("Adding hex data:", hexData);
      scriptElements.push(Buffer.from(hexData, "hex"));
    } else if (/^\d+$/.test(line)) {
      // Handle numbers
      const num = parseInt(line);
      console.log("Processing number:", num);

      if (num >= 1 && num <= 16) {
        const opcode = opcodes.OP_1 + num - 1;
        console.log("Adding small number as opcode:", num, "=", opcode);
        scriptElements.push(opcode);
      } else if (num === 0) {
        console.log("Adding OP_0");
        scriptElements.push(opcodes.OP_0);
      } else {
        // For larger numbers, push as data
        const encoded = bitcoinScript.number.encode(num);
        console.log("Adding large number as data:", num, "encoded length:", encoded.length);
        scriptElements.push(Buffer.from(encoded));
      }
    } else if (line.length > 0) {
      throw new Error(`Cannot parse line: ${line}`);
    }
  }

  console.log("Script elements:", scriptElements);
  const compiled = bitcoinScript.compile(scriptElements);
  //@ts-ignore
  console.log("Compiled script:", compiled ? compiled.toString("hex") : "null");

  return Buffer.from(compiled);
}

// Main function to create script transaction
export async function createScriptTransaction(scriptCode: string, amount: number, walletAddress: string, publicKey: Buffer): Promise<{ txid: string; scriptAddress: string }> {
  console.log("Starting script transaction creation...");
  console.log("Script code:", scriptCode);
  console.log("Amount:", amount);
  console.log("Wallet address:", walletAddress);
  console.log("Public key length:", publicKey.length);

  try {
    // Parse and compile the script
    console.log("Step 1: Parsing script...");
    const compiledScript = parseScript(scriptCode);
    console.log("Compiled script length:", compiledScript.length);

    // Create P2WSH (Pay to Witness Script Hash) output
    console.log("Step 2: Creating P2WSH...");
    const p2wsh = payments.p2wsh({
      redeem: { output: compiledScript },
      network: networks.testnet,
    });

    if (!p2wsh.address) {
      throw new Error("Failed to generate script address");
    }
    console.log("Script address:", p2wsh.address);

    // Get UTXOs from wallet
    console.log("Step 3: Fetching UTXOs...");
    const utxos = await getUtxos(walletAddress);
    console.log("UTXOs found:", utxos?.length || 0);

    if (!utxos || utxos.length === 0) {
      throw new Error("No UTXOs available. Make sure your wallet has testnet Bitcoin.");
    }

    // Select UTXOs for the transaction
    console.log("Step 4: Selecting UTXOs...");
    const estimatedFee = 1000; // Conservative fee estimate
    const totalNeeded = amount + estimatedFee;
    console.log("Total needed:", totalNeeded);

    // Check if we have enough balance first
    const totalAvailable = utxos.reduce((sum: number, utxo: any) => sum + utxo.value, 0);
    console.log("Total available:", totalAvailable);

    if (totalAvailable < totalNeeded) {
      throw new Error(`Insufficient funds: have ${totalAvailable}, need ${totalNeeded}`);
    }

    const { selectedUtxos, totalValue } = selectUtxos(utxos, totalNeeded);
    console.log("Selected UTXOs:", selectedUtxos.length, "Total value:", totalValue);

    // Calculate change
    const changeAmount = totalValue - amount - estimatedFee;
    console.log("Change amount:", changeAmount);

    // Create PSBT
    console.log("Step 5: Creating PSBT...");
    const psbt = new Psbt({ network: networks.testnet });

    // Add inputs
    console.log("Step 6: Adding inputs...");
    for (const utxo of selectedUtxos) {
      console.log("Adding UTXO:", utxo.txid, utxo.vout, utxo.value);
      console.log("Wallet address:", walletAddress);
      console.log("Public key hex:", publicKey.toString("hex"));

      try {
        // Fetch the actual transaction to get the correct output script
        console.log(`Fetching transaction ${utxo.txid} to get output script...`);
        const ESPLORA_BASE = (process.env.NEXT_PUBLIC_BTC_ESPLORA_API || "https://signet.surge.dev/api").replace(/\/$/, "");
        const txUrl = `${ESPLORA_BASE}/tx/${utxo.txid}`;

        const txResponse = await fetch(txUrl);
        if (!txResponse.ok) {
          throw new Error(`Failed to fetch transaction ${utxo.txid}: ${txResponse.status}`);
        }

        const txData = await txResponse.json();

        if (!txData.vout || !txData.vout[utxo.vout]) {
          throw new Error(`Output ${utxo.vout} not found in transaction ${utxo.txid}`);
        }

        // Get the actual output script from the blockchain
        const actualOutputScript = Buffer.from(txData.vout[utxo.vout].scriptpubkey, "hex");
        console.log("Actual output script:", actualOutputScript.toString("hex"));

        let inputData: any = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: actualOutputScript,
            value: BigInt(utxo.value),
          },
        };

        // For Taproot addresses, add tapInternalKey if needed
        if (walletAddress!.startsWith("tb1p")) {
          console.log("Detected Taproot address - adding tapInternalKey");
          // Get x-only public key (first 32 bytes of compressed public key)
          const xOnlyPubkey = publicKey.length === 33 ? publicKey.subarray(1) : publicKey.subarray(0, 32);
          console.log("X-only pubkey:", xOnlyPubkey.toString("hex"));
          inputData.tapInternalKey = xOnlyPubkey;
        }

        console.log("Adding input with data:", inputData);
        psbt.addInput(inputData);
        console.log("Successfully added input");
      } catch (inputError) {
        console.error("Failed to add input:", inputError);
        throw new Error(`Failed to add UTXO ${utxo.txid}:${utxo.vout} - ${inputError instanceof Error ? inputError.message : "Unknown error"}`);
      }
    }

    // Add script output
    console.log("Step 7: Adding outputs...");
    psbt.addOutput({
      address: p2wsh.address,
      value: BigInt(amount),
    });

    // Add change output if needed
    if (changeAmount >= 546) {
      // Dust threshold
      psbt.addOutput({
        address: walletAddress,
        value: BigInt(changeAmount),
      });
    }

    // Convert to hex for wallet signing
    console.log("Step 8: Converting PSBT to hex...");
    const psbtHex = psbt.toHex();
    console.log("PSBT hex length:", psbtHex.length);

    // Sign with UniSat wallet
    console.log("Step 9: Signing with UniSat wallet...");
    if (!window.unisat) {
      throw new Error("UniSat wallet not available");
    }

    // Use simple signing like in the working btc-script-playground code
    console.log("Signing PSBT with UniSat...");
    const signedPsbtHex = await window.unisat.signPsbt(psbtHex);
    console.log("Signed PSBT received");

    // Extract final transaction like in btc-script-playground
    console.log("Step 10: Extracting final transaction...");
    const signedPsbt = Psbt.fromHex(signedPsbtHex);
    const finalTx = signedPsbt.extractTransaction();
    console.log("Final transaction size:", finalTx.toHex().length / 2, "bytes");

    // Broadcast transaction
    console.log("Step 11: Broadcasting transaction...");
    const txid = await pushTx(finalTx.toHex());
    console.log("Transaction broadcast successfully:", txid);

    // Save tracked script for later unlocking
    console.log("Step 12: Saving tracked script...");
    const trackedScript: TrackedScript = {
      id: `${txid}_0`, // Use txid + output index as unique ID
      scriptAddress: p2wsh.address,
      originalScript: scriptCode,
      compiledScript: compiledScript.toString("hex"),
      createdAt: Date.now(),
      createdBy: walletAddress,
      fundingTxid: txid,
      amount: amount,
      isSpent: false,
    };

    saveTrackedScript(trackedScript);
    console.log("Tracked script saved for future unlocking");

    return {
      txid,
      scriptAddress: p2wsh.address,
    };
  } catch (error) {
    console.error("Script transaction error at step:", error);
    console.error("Error details:", error);

    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes("Insufficient funds")) {
        throw new Error("Insufficient funds. Make sure you have enough testnet Bitcoin plus fee.");
      } else if (error.message.includes("Unknown opcode")) {
        throw new Error(`Script parsing error: ${error.message}`);
      } else if (error.message.includes("Failed to fetch UTXOs")) {
        throw new Error("Failed to fetch UTXOs. Check your internet connection and wallet address.");
      } else if (error.message.includes("Failed to broadcast")) {
        throw new Error("Failed to broadcast transaction. The transaction may be invalid.");
      }
    }

    throw error;
  }
}
