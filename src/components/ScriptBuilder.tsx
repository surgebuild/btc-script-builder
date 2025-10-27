"use client";

import { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { useBtcWallet } from "@/lib/context/WalletContext";
import { createScriptTransaction, addressToHex, isBitcoinAddress, formatBalance } from "@/lib/scriptUtils";
import { requestFaucetFunds } from "@/hooks/faucet";
import ScriptEditor from "./ScriptEditor";

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
    toast.success(`📝 Loaded ${template.name} template`);
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
          <div className="text-sm text-gray-500">Choose a starting point</div>
        </div>

        <Formik initialValues={{ scriptCode: "", amount: 1000 }} validationSchema={ScriptSchema} onSubmit={handleSubmit}>
          {({ errors, touched, setFieldValue, values }) => (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {SCRIPT_TEMPLATES.map((template) => (
                  <button key={template.id} type="button" onClick={() => loadTemplate(template, setFieldValue)} className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left group hover:shadow-lg ${selectedTemplate === template.id ? "bg-orange-50 border-orange-300 shadow-md" : "bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-300"}`} title={template.description}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-2xl">{template.icon}</div>
                      <div className="text-xs px-2 py-1 bg-white rounded-full text-gray-600 border">{template.category}</div>
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
                        <span className="text-gray-300 text-sm font-mono">script.ts</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>Bitcoin Script</span>
                        <span>•</span>
                        <span>Testnet</span>
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

                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 font-mono">Amount</h4>
                    <Field type="number" name="amount" placeholder="Enter satoshis" className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-0 font-mono text-lg ${errors.amount && touched.amount ? "border-red-500 focus:border-red-500 bg-red-50" : "border-gray-200 focus:border-orange-400 bg-gray-50"}`} />
                    <ErrorMessage name="amount" component="div" className="text-red-500 text-sm mt-2" />
                    <div className="text-xs text-gray-500 mt-2 font-mono">Minimum: 546 sats (dust threshold)</div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 font-mono">Network Fee</h4>
                    <div className="px-4 py-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                      <div className="text-lg font-mono text-yellow-800">~500 sats</div>
                      <div className="text-xs text-yellow-600 mt-1">Estimated transaction fee</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 font-mono">Actual fee may vary based on network conditions</div>
                  </div>
                </div> */}

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
                      "✅ Transaction Complete"
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
                📋 Copy TX Hash
              </button>
              <button onClick={() => navigator.clipboard.writeText(scriptAddress)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                📋 Copy Address
              </button>
              <a href={`https://signet.surge.dev/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                🔗 View Explorer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
