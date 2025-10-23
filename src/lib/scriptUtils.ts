import ecc from "@bitcoinerlab/secp256k1";
import { initEccLib, networks, payments, Psbt, script as bitcoinScript, opcodes, address, crypto } from "bitcoinjs-lib";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import { ECPairFactory } from "ecpair";
import { getUtxos, pushTx } from "@/hooks/api";

// Initialize ECC library
initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

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
  
  const lines = scriptText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
  console.log("Parsed lines:", lines);
  
  const scriptElements: (number | Buffer)[] = [];
  
  for (const line of lines) {
    console.log("Processing line:", line);
    
    if (line.startsWith('OP_')) {
      // Handle opcodes
      const opcodeName = line as keyof typeof opcodes;
      if (opcodes[opcodeName] !== undefined) {
        console.log("Adding opcode:", opcodeName, "=", opcodes[opcodeName]);
        scriptElements.push(opcodes[opcodeName]);
      } else {
        throw new Error(`Unknown opcode: ${line}`);
      }
    } else if (line.startsWith('0x')) {
      // Handle hex data
      const hexData = line.slice(2);
      if (hexData.length % 2 !== 0) {
        throw new Error(`Invalid hex data: ${line}`);
      }
      console.log("Adding hex data:", hexData);
      scriptElements.push(Buffer.from(hexData, 'hex'));
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
  console.log("Compiled script:", compiled ? compiled.toString('hex') : 'null');
  
  return Buffer.from(compiled);
}

// Main function to create script transaction
export async function createScriptTransaction(
  scriptCode: string,
  amount: number,
  walletAddress: string,
  publicKey: Buffer
): Promise<{ txid: string; scriptAddress: string }> {
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
      console.log("Public key hex:", publicKey.toString('hex'));
      
      try {
        // Create the witness script based on the wallet address type
        let witnessScript: Uint8Array;
        let inputData: any = {
          hash: utxo.txid,
          index: utxo.vout,
        };
        
        if (walletAddress!.startsWith('tb1p')) {
          // Taproot address (P2TR) - key-path spending
          console.log("Detected Taproot address");
          
          // For Taproot, use the x-only public key directly
          const xOnlyPubkey = toXOnly(publicKey);
          //@ts-ignore
          console.log("X-only pubkey:", xOnlyPubkey.toString('hex'));
          
          // Create P2TR payment using x-only public key
          const p2tr = payments.p2tr({ 
            pubkey: xOnlyPubkey,
            network: networks.testnet 
          });
          
          witnessScript = p2tr.output!;
          inputData.witnessUtxo = {
            script: witnessScript,
            value: BigInt(utxo.value),
          };
          // For key-path spending, set tapInternalKey
          inputData.tapInternalKey = xOnlyPubkey;
          
        } else if (walletAddress!.startsWith('tb1')) {
          // Native SegWit address (P2WPKH) 
          console.log("Detected Native SegWit address");
          
          const p2wpkh = payments.p2wpkh({ 
            pubkey: publicKey, 
            network: networks.testnet 
          });
          
          witnessScript = p2wpkh.output!;
          inputData.witnessUtxo = {
            script: witnessScript,
            value: BigInt(utxo.value),
          };
          
        } else {
          // Legacy address (P2PKH or P2SH) - might need nonWitnessUtxo
          console.log("Detected Legacy address");
          
          // For legacy addresses, we often need the full previous transaction
          // Let's try with witnessUtxo first (works for most cases)
          try {
            witnessScript = address.toOutputScript(walletAddress!, networks.testnet);
            inputData.witnessUtxo = {
              script: witnessScript,
              value: BigInt(utxo.value),
            };
          } catch (scriptError) {
            console.error("Failed to create script from address:", scriptError);
            throw new Error("Unsupported address type for script creation");
          }
        }
        
        console.log("Adding input with data:", inputData);
        psbt.addInput(inputData);
        console.log("Successfully added input");
        
      } catch (inputError) {
        console.error("Failed to add input:", inputError);
        throw new Error(`Failed to add UTXO ${utxo.txid}:${utxo.vout} - ${inputError instanceof Error ? inputError.message : 'Unknown error'}`);
      }
    }
    
    // Add script output
    console.log("Step 7: Adding outputs...");
    psbt.addOutput({
      address: p2wsh.address,
      value: BigInt(amount),
    });
    
    // Add change output if needed
    if (changeAmount >= 546) { // Dust threshold
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