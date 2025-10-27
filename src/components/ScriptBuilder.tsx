"use client";

import { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useBtcWallet } from "@/lib/context/WalletContext";
import { createScriptTransaction, addressToHex, isBitcoinAddress, formatBalance } from "@/lib/scriptUtils";
import { requestFaucetFunds } from "@/hooks/faucet";
import ScriptEditor from "./ScriptEditor";
import { networks, payments, script as bitcoinScript } from "bitcoinjs-lib";
import { createHash } from "crypto";

const ScriptSchema = Yup.object().shape({
  scriptCode: Yup.string().required("Script code is required").min(1, "Script cannot be empty"),
  amount: Yup.number().positive("Amount must be positive").min(546, "Minimum amount is 546 sats (dust threshold)").required("Amount is required"),
});

const SCRIPT_TEMPLATES = [
  {
    id: "hashlock",
    name: "Hash Lock",
    icon: "🔐",
    description: "Require revealing a secret preimage",
    code: `// Hash Lock Script - requires revealing a secret
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL`,
    suggestedAmount: 1000,
    category: "Security",
  },
  {
    id: "timelock",
    name: "Timelock",
    icon: "🕒",
    description: "Unlock after specific block height",
    code: `// Relative Timelock - funds locked for 144 blocks
144 
OP_CHECKSEQUENCEVERIFY 
OP_DROP 
OP_DUP 
OP_HASH160 
0x89abcdefabbaabbaabbaabbaabbaabbaabbaabba 
OP_EQUALVERIFY 
OP_CHECKSIG`,
    suggestedAmount: 2000,
    category: "Time",
  },
  {
    id: "multisig",
    name: "Multisig",
    icon: "👥",
    description: "Require m-of-n signatures",
    code: `// 2-of-3 Multisig
OP_2 
0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798 
0x02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9 
0x03e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13 
OP_3 
OP_CHECKMULTISIG`,
    suggestedAmount: 5000,
    category: "Security",
  },
  {
    id: "puzzle",
    name: "Math Puzzle",
    icon: "🧩",
    description: "Custom logic challenge",
    code: `// Math Puzzle - requires inputs that add to 10
OP_ADD 
10 
OP_EQUAL`,
    suggestedAmount: 1000,
    category: "Logic",
  },
  {
    id: "taproot-hashlock",
    name: "Taproot Hash Lock",
    icon: "🌳",
    description: "Taproot script with hash preimage",
    code: `// Taproot Hash Lock (Tapscript) - spendable with secret preimage
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL`,
    suggestedAmount: 2000,
    category: "Taproot",
    scriptType: "P2TR",
  },
];

type TransactionStep = "prepare" | "validate" | "sign" | "broadcast" | "complete";

export default function ScriptBuilder() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [scriptAddress, setScriptAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<TransactionStep>("prepare");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  const { isConnected, walletAddress, balance } = useBtcWallet();

  const handleFaucetRequest = async () => {
    if (!walletAddress) {
      toast.error("No wallet connected");
      return;
    }

    setFaucetLoading(true);
    try {
      await requestFaucetFunds(walletAddress);
      toast.success("Testnet funds requested! Check your wallet in a few minutes.");
    } catch (error) {
      console.error("Faucet error:", error);
      toast.error("Failed to request funds. Please try again later.");
    } finally {
      setFaucetLoading(false);
    }
  };

  const loadTemplate = (template: any, setFieldValue: any) => {
    setSelectedTemplate(template.id);
    setFieldValue("scriptCode", template.code);
    setFieldValue("amount", template.suggestedAmount);
  };

  const handlePaste = (event: React.ClipboardEvent, setFieldValue: any, currentValue: string) => {
    const pastedText = event.clipboardData.getData("text");
    const trimmedText = pastedText.trim();

    if (isBitcoinAddress(trimmedText)) {
      const hex = addressToHex(trimmedText);
      if (hex) {
        event.preventDefault();
        const textarea = event.target as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = currentValue.substring(0, start) + hex + currentValue.substring(end);
        setFieldValue("scriptCode", newValue);
        toast.success(`🔄 Converted address to hex: ${hex.slice(0, 20)}...`);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + hex.length;
          textarea.focus();
        }, 0);
      } else {
        toast.error("❌ Could not extract public key from this address type. Only Taproot addresses (tb1p...) support direct conversion.");
      }
    }
  };

  const handleSubmit = async (values: any) => {
    if (!isConnected || !walletAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      setCurrentStep("validate");

      // Step progress
      setTimeout(() => setCurrentStep("sign"), 500);
      setTimeout(() => setCurrentStep("broadcast"), 1500);

      const result = await createScriptTransaction(
        values.scriptCode,
        values.amount,
        walletAddress,
        Buffer.alloc(32) // placeholder pubkey
      );

      setTxHash(result.txid);
      setScriptAddress(result.scriptAddress);
      setTransactionDetails({
        amount: values.amount,
        estimatedFee: 500,
        scriptType: "P2WSH",
      });

      setCurrentStep("complete");
      toast.success("🎉 Script transaction created successfully!");
    } catch (error) {
      console.error("Transaction failed:", error);
      toast.error(error instanceof Error ? error.message : "Transaction failed");
      setCurrentStep("prepare");
    } finally {
      setLoading(false);
    }
  };

  // Script parsing and analysis functions
  const parseScriptCode = (scriptCode: string) => {
    if (!scriptCode.trim()) return null;

    try {
      const lines = scriptCode
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//"));
      const opcodes: Buffer[] = [];

      for (const line of lines) {
        if (line.startsWith("0x")) {
          // Hex data
          const hex = line.slice(2);
          if (hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) {
            const data = Buffer.from(hex, "hex");
            opcodes.push(data);
          } else {
            throw new Error(`Invalid hex data: ${line}`);
          }
        } else if (line.match(/^\d+$/)) {
          // Numbers
          const num = parseInt(line);
          const encoded = bitcoinScript.number.encode(num);
          opcodes.push(Buffer.from(encoded));
        } else if (line.startsWith("OP_")) {
          // Opcodes
          const opcodeName = line as keyof typeof bitcoinScript.OPS;
          if (bitcoinScript.OPS[opcodeName] !== undefined) {
            opcodes.push(Buffer.from([bitcoinScript.OPS[opcodeName]]));
          } else {
            throw new Error(`Unknown opcode: ${line}`);
          }
        } else {
          throw new Error(`Cannot parse line: ${line}`);
        }
      }

      return bitcoinScript.compile(opcodes);
    } catch (error) {
      console.error("Script parsing error:", error);
      return null;
    }
  };

  const analyzeScript = (scriptCode: string) => {
    const compiledScript = parseScriptCode(scriptCode);
    if (!compiledScript) {
      return {
        isValid: false,
        error: "Failed to parse script",
        scriptType: "Invalid",
        asm: "",
        scriptPubKey: "",
        address: "",
        explanation: "Script contains syntax errors",
      };
    }

    try {
      // Determine if this should be Taproot based on selected template or script content
      const selectedTemplateData = SCRIPT_TEMPLATES.find((t) => t.id === selectedTemplate);
      const isTaproot = selectedTemplateData?.scriptType === "P2TR" || scriptCode.includes("// Taproot");

      // Generate ASM representation
      const asm = bitcoinScript.toASM(compiledScript);

      let scriptType: string;
      let payment: any;
      let explanation: string;

      if (isTaproot) {
        // Create Taproot P2TR payment
        try {
          payment = payments.p2tr({
            scriptTree: {
              output: compiledScript,
            },
            network: networks.testnet,
          });
          scriptType = "P2TR";
          explanation = "Pay to Taproot - spendable via script path by providing witness data that satisfies the tapscript.";
        } catch (taprootError) {
          // Fallback to P2WSH if Taproot fails
          payment = payments.p2wsh({
            redeem: { output: compiledScript },
            network: networks.testnet,
          });
          scriptType = "P2WSH (Taproot fallback)";
          explanation = "Taproot creation failed, using P2WSH - spendable by providing witness data that satisfies the script.";
        }
      } else {
        // Create traditional P2WSH payment
        payment = payments.p2wsh({
          redeem: { output: compiledScript },
          network: networks.testnet,
        });
        scriptType = "P2WSH";
        explanation = "Pay to Witness Script Hash - spendable by providing witness data that satisfies the script.";
      }

      // Customize explanation based on script content
      if (scriptCode.includes("OP_SHA256") && scriptCode.includes("OP_EQUAL")) {
        if (isTaproot) {
          explanation = "Taproot Hash Lock - spendable via script path by providing the correct preimage that hashes to the expected value.";
        } else {
          explanation = "Hash Lock Script - spendable by providing the correct preimage that hashes to the expected value.";
        }
      } else if (scriptCode.includes("OP_CHECKSEQUENCEVERIFY") || scriptCode.includes("OP_CHECKLOCKTIMEVERIFY")) {
        if (isTaproot) {
          explanation = "Taproot Timelock - spendable via script path only after the specified time/block height condition is met.";
        } else {
          explanation = "Timelock Script - spendable only after the specified time/block height condition is met.";
        }
      } else if (scriptCode.includes("OP_CHECKMULTISIG")) {
        if (isTaproot) {
          explanation = "Taproot Multisig - spendable via script path by providing the required signatures (consider MuSig2 for key path).";
        } else {
          explanation = "Multisig Script - spendable by providing the required number of signatures from the specified public keys.";
        }
      } else if (scriptCode.includes("OP_ADD") || scriptCode.includes("OP_SUB")) {
        if (isTaproot) {
          explanation = "Taproot Math Puzzle - spendable via script path by providing inputs that satisfy the mathematical conditions.";
        } else {
          explanation = "Math Puzzle Script - spendable by providing inputs that satisfy the mathematical conditions.";
        }
      }

      return {
        isValid: true,
        error: null,
        scriptType,
        asm,
        scriptPubKey: payment.output ? Buffer.from(payment.output).toString("hex") : "",
        address: payment.address || "",
        explanation,
        compiledScript: Buffer.from(compiledScript).toString("hex"),
        isTaproot,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        scriptType: "Invalid",
        asm: "",
        scriptPubKey: "",
        address: "",
        explanation: "Failed to generate script address",
      };
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error(`Failed to copy ${label}`);
    }
  };

  const formatASMWithSyntaxHighlighting = (asm: string) => {
    return asm.split(" ").map((part, index) => {
      let className = "text-white";
      if (part.startsWith("OP_")) {
        if (part.includes("SHA") || part.includes("HASH") || part.includes("SIG")) {
          className = "text-red-400"; // Crypto ops
        } else if (part.includes("ADD") || part.includes("SUB") || part.includes("EQUAL")) {
          className = "text-blue-400"; // Math/logic ops
        } else if (part.includes("DUP") || part.includes("DROP") || part.includes("SWAP")) {
          className = "text-purple-400"; // Stack ops
        } else {
          className = "text-yellow-400"; // Other ops
        }
      } else if (part.match(/^[0-9a-fA-F]+$/)) {
        className = "text-cyan-400"; // Hex data
      } else if (part.match(/^\d+$/)) {
        className = "text-green-400"; // Numbers
      }

      return (
        <span key={index} className={className}>
          {part}
          {index < asm.split(" ").length - 1 ? " " : ""}
        </span>
      );
    });
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">Script Editor</h1>
          <p className="text-sm text-gray-600">Write, test, and deploy Bitcoin scripts</p>
        </div>
        <div className="flex items-center space-x-3">
          {balance !== null && (
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg font-mono">
              Balance: <span className="font-semibold text-green-600">{formatBalance(balance)}</span>
            </div>
          )}
          <button onClick={handleFaucetRequest} disabled={faucetLoading || !isConnected} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-md transition-all duration-200">
            {faucetLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Requesting...</span>
              </>
            ) : (
              <>
                <span>💧</span>
                <span>Testnet Faucet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Template Cards */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 font-mono">Script Templates</h3>
        </div>

        <Formik initialValues={{ scriptCode: "", amount: 1000 }} validationSchema={ScriptSchema} onSubmit={handleSubmit}>
          {({ errors, touched, setFieldValue, values }) => (
            <>
              <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                {SCRIPT_TEMPLATES.map((template) => (
                  <button key={template.id} type="button" onClick={() => loadTemplate(template, setFieldValue)} className={`flex-shrink-0 w-56 p-4 rounded-2xl border-2 transition-all duration-200 text-left group hover:shadow-lg ${selectedTemplate === template.id ? "bg-orange-50 border-orange-300 shadow-md" : "bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-300"}`} title={template.description}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-2xl">{template.icon}</div>
                      <div className="text-xs px-2 py-1 rounded-full border text-gray-600 bg-white">{template.category}</div>
                    </div>
                    <div className="font-semibold text-gray-900 text-sm mb-1 font-mono">{template.name}</div>
                    <div className="text-xs text-gray-600 leading-relaxed">{template.description}</div>
                    <div className="text-xs text-orange-600 mt-2 font-mono">~{template.suggestedAmount} sats</div>
                  </button>
                ))}
              </div>

              <Form className="space-y-6">
                {/* Script Editor */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-900 px-6 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-2">
                          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                        <span className="text-gray-300 text-sm font-mono">script.exe</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>Bitcoin Script</span>
                        <span>•</span>
                        <span>Signet</span>
                      </div>
                    </div>
                  </div>

                  <Field name="scriptCode">
                    {({ field }: any) => (
                      <ScriptEditor
                        value={field.value}
                        onChange={(value) => setFieldValue("scriptCode", value)}
                        onPaste={(e) => handlePaste(e, setFieldValue, values.scriptCode)}
                        placeholder={`// Write your Bitcoin script here...
// Example: Hash Lock
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL

// Tip: Paste Bitcoin addresses for auto hex conversion!`}
                        rows={14}
                        className={errors.scriptCode && touched.scriptCode ? "border-red-500" : "border-gray-600"}
                      />
                    )}
                  </Field>
                  <ErrorMessage name="scriptCode" component="div" className="text-red-500 text-sm px-6 py-2 bg-red-50" />
                </div>

                {/* Script Preview Panel */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <button type="button" onClick={() => setShowScriptPreview(!showScriptPreview)} className="w-full px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-left flex items-center justify-between transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`transform transition-transform text-zinc-400 ${showScriptPreview ? "rotate-90" : ""}`}>▶</div>
                      <span className="text-zinc-200 font-mono text-sm font-semibold">On Chain Script Preview</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">{values.scriptCode.trim() ? "" : "Enter script code"}</div>
                  </button>

                  {showScriptPreview && (
                    <div className="bg-zinc-900 text-sm font-mono border-t border-zinc-700">
                      {(() => {
                        const analysis = analyzeScript(values.scriptCode);

                        if (!values.scriptCode.trim()) {
                          return (
                            <div className="p-6 text-center text-zinc-500">
                              <div className="text-4xl mb-3 opacity-50">📄</div>
                              <div>Enter script code above to see preview</div>
                            </div>
                          );
                        }

                        if (!analysis.isValid) {
                          return (
                            <div className="p-6">
                              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                                <div className="text-red-400 font-semibold mb-2">❌ Script Error</div>
                                <div className="text-red-300 text-xs">{analysis.error}</div>
                              </div>
                              <div className="text-zinc-500 text-xs">Fix the script syntax to see the preview</div>
                            </div>
                          );
                        }

                        return (
                          <div className="p-6 space-y-4">
                            {/* Script Type */}
                            <div>
                              <div className="text-zinc-400 text-xs mb-2">Script Type:</div>
                              <div className="bg-zinc-800 rounded-lg p-3">
                                <span className={`font-semibold ${analysis.scriptType.startsWith("P2TR") ? "text-orange-400" : "text-blue-400"}`}>
                                  {analysis.scriptType}
                                  {analysis.scriptType.startsWith("P2TR") && <span className="ml-2">🌳</span>}
                                </span>
                              </div>
                            </div>

                            {/* Final ASM */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-zinc-400 text-xs">ASM:</div>
                                <button type="button" onClick={() => copyToClipboard(analysis.asm, "ASM")} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                  📋 Copy
                                </button>
                              </div>
                              <div className="bg-zinc-800 rounded-lg p-3 overflow-x-auto">
                                <div className="whitespace-nowrap">{formatASMWithSyntaxHighlighting(analysis.asm)}</div>
                              </div>
                            </div>

                            {/* scriptPubKey */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-zinc-400 text-xs">scriptPubKey (hex):</div>
                                <button type="button" onClick={() => copyToClipboard(analysis.scriptPubKey, "scriptPubKey")} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                  📋 Copy
                                </button>
                              </div>
                              <div className="bg-zinc-800 rounded-lg p-3 overflow-x-auto">
                                <div className="text-cyan-400 text-xs break-all">{analysis.scriptPubKey || "Failed to generate"}</div>
                              </div>
                            </div>

                            {/* Address */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-zinc-400 text-xs">Address:</div>
                                <button type="button" onClick={() => copyToClipboard(analysis.address, "Address")} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors">
                                  📋 Copy
                                </button>
                              </div>
                              <div className="bg-zinc-800 rounded-lg p-3">
                                <div className="text-green-400 text-xs font-semibold break-all">{analysis.address || "Failed to generate"}</div>
                              </div>
                            </div>

                            {/* Explanation */}
                            <div>
                              <div className="text-zinc-400 text-xs mb-2">Explanation:</div>
                              <div className="bg-zinc-800 rounded-lg p-3">
                                <div className="text-zinc-300 text-xs leading-relaxed">{analysis.explanation}</div>
                              </div>
                            </div>

                            {/* Optional Links */}
                            <div className="pt-2 border-t border-zinc-700">
                              <div className="text-zinc-500 text-xs">
                                Learn more:
                                <a href="https://learnmeabitcoin.com/technical/script/" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-400 hover:text-blue-300 underline">
                                  Bitcoin Script Reference
                                </a>
                                {analysis.scriptType === "P2WSH" && (
                                  <>
                                    {" • "}
                                    <a href="https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                                      BIP-141 (SegWit)
                                    </a>
                                  </>
                                )}
                                {analysis.scriptType.startsWith("P2TR") && (
                                  <>
                                    {" • "}
                                    <a href="https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
                                      BIP-341 (Taproot)
                                    </a>
                                    {" • "}
                                    <a href="https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">
                                      BIP-342 (Tapscript)
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Deploy Button */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <button type="submit" disabled={loading || !isConnected || currentStep !== "prepare"} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-xl font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-mono">
                    {loading ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>{currentStep === "validate" && "Validating Script..."}</span>
                        <span>{currentStep === "sign" && "Signing Transaction..."}</span>
                        <span>{currentStep === "broadcast" && "Broadcasting to Network..."}</span>
                      </div>
                    ) : currentStep === "complete" ? (
                      "Transaction Complete"
                    ) : (
                      "Deploy Script"
                    )}
                  </button>

                  {!isConnected && <div className="text-center text-sm text-gray-500 mt-3">Connect your wallet to deploy scripts</div>}
                </div>
              </Form>
            </>
          )}
        </Formik>
      </div>

      {/* Transaction Success */}
      {txHash && scriptAddress && (
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-6 border-l-4 border-l-green-500">
          <h3 className="text-xl font-bold text-green-800 mb-4 font-mono flex items-center">🎉 Script Deployed Successfully!</h3>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Transaction Hash</div>
              <div className="p-3 bg-gray-900 rounded-xl font-mono text-sm text-green-400 break-all">{txHash}</div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Script Address</div>
              <div className="p-3 bg-gray-900 rounded-xl font-mono text-sm text-blue-400 break-all">{scriptAddress}</div>
            </div>

            {transactionDetails && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 font-mono">{transactionDetails.amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">Sats Locked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 font-mono">{transactionDetails.estimatedFee}</div>
                  <div className="text-xs text-gray-600">Fee Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600 font-mono">{transactionDetails.scriptType}</div>
                  <div className="text-xs text-gray-600">Script Type</div>
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button onClick={() => navigator.clipboard.writeText(txHash)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                📋 Copy Tx Hash
              </button>
              <button onClick={() => navigator.clipboard.writeText(scriptAddress)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                📋 Copy Address
              </button>
              <a href={`https://signet.surge.dev/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                🔗 View on Mempool
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
