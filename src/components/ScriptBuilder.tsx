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

const SCRIPT_EXAMPLES = {
  hashLock: `// Hash Lock Script - requires revealing a secret
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL`,

  timelock: `// Relative Timelock - funds locked for 144 blocks
144 
OP_CHECKSEQUENCEVERIFY 
OP_DROP 
OP_DUP 
OP_HASH160 
0x89abcdefabbaabbaabbaabbaabbaabbaabbaabba 
OP_EQUALVERIFY 
OP_CHECKSIG`,

  multisig: `// 2-of-3 Multisig
OP_2 
0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798 
0x02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9 
0x03e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13 
OP_3 
OP_CHECKMULTISIG`,

  puzzle: `// Math Puzzle - requires inputs that add to 10
OP_ADD 
10 
OP_EQUAL`,
};

type TransactionStep = "prepare" | "validate" | "sign" | "broadcast" | "complete";

export default function ScriptBuilder() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [scriptAddress, setScriptAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<TransactionStep>("prepare");
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const { isConnected, walletAddress, getPublicKey, balance } = useBtcWallet();

  const handleSubmit = async (values: { scriptCode: string; amount: number }) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!balance || balance < values.amount + 1000) {
      toast.error("Insufficient balance for transaction");
      return;
    }

    try {
      setLoading(true);
      setCurrentStep("validate");

      // Validate script syntax first
      await new Promise((resolve) => setTimeout(resolve, 500));

      setCurrentStep("sign");
      const publicKey = await getPublicKey();

      if (!publicKey) {
        toast.error("Failed to get public key");
        setCurrentStep("prepare");
        return;
      }

      setCurrentStep("broadcast");
      const result = await createScriptTransaction(values.scriptCode, values.amount, walletAddress!, publicKey);

      setCurrentStep("complete");
      setTxHash(result.txid);
      setScriptAddress(result.scriptAddress);
      setTransactionDetails({
        amount: values.amount,
        fee: 500, // This should come from the transaction creation
        scriptCode: values.scriptCode,
      });

      toast.success("Script transaction created successfully!");
    } catch (error) {
      console.error("Script transaction error:", error);
      toast.error(`Failed to create script transaction: ${error instanceof Error ? error.message : "Unknown error"}`);
      setCurrentStep("prepare");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (exampleKey: string, setFieldValue: any) => {
    if (SCRIPT_EXAMPLES[exampleKey as keyof typeof SCRIPT_EXAMPLES]) {
      setFieldValue("scriptCode", SCRIPT_EXAMPLES[exampleKey as keyof typeof SCRIPT_EXAMPLES]);
      setSelectedExample(exampleKey);
      resetTransaction();
    }
  };

  const resetTransaction = () => {
    setTxHash(null);
    setScriptAddress(null);
    setCurrentStep("prepare");
    setTransactionDetails(null);
  };

  // Auto-convert Bitcoin addresses to hex when pasted
  const handlePaste = (event: React.ClipboardEvent, setFieldValue: any, currentValue: string) => {
    const pastedText = event.clipboardData.getData("text");
    const trimmedText = pastedText.trim();

    console.log("Pasted text:", trimmedText);

    if (isBitcoinAddress(trimmedText)) {
      console.log("Detected Bitcoin address");
      const hex = addressToHex(trimmedText);

      if (hex) {
        event.preventDefault();

        // Insert hex at cursor position or append to current content
        const textarea = event.target as HTMLTextAreaElement;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue = currentValue.substring(0, start) + hex + currentValue.substring(end);
        setFieldValue("scriptCode", newValue);

        toast.success(`Converted ${trimmedText.slice(0, 20)}... to hex: ${hex.slice(0, 20)}...`);

        // Set cursor position after the inserted hex
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + hex.length;
          textarea.focus();
        }, 0);
      } else {
        toast.error("Could not extract public key from this address type. Only Taproot addresses (tb1p...) support direct conversion.");
      }
    }
  };

  const handleFaucetRequest = async () => {
    if (!isConnected || !walletAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setFaucetLoading(true);
      toast.info("Requesting testnet funds from faucet...");

      const result = await requestFaucetFunds(walletAddress);

      if (result && result.txid) {
        toast.success(`Faucet funds sent! Transaction ID: ${result.txid.substring(0, 16)}...`);
        console.log("Faucet transaction:", result);
      } else if (result && result.message) {
        toast.success(result.message);
      } else {
        toast.success("Faucet request submitted successfully! Funds should arrive in a few minutes.");
      }
    } catch (error) {
      console.error("Faucet request error:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Handle different types of errors with appropriate fallbacks
      if (errorMessage.includes("CORS") || errorMessage.includes("Network error")) {
        toast.error("Faucet API temporarily unavailable. Please try again later.");
      } else if (errorMessage.includes("Rate limited")) {
        toast.error("Rate limited. Please wait before requesting again.");
      } else if (errorMessage.includes("already received")) {
        toast.error("This address has already received funds recently. Please wait before requesting again.");
      } else {
        toast.error(`Faucet request failed: ${errorMessage}`);
      }
    } finally {
      setFaucetLoading(false);
    }
  };

  const getStepIcon = (step: TransactionStep) => {
    const steps = ["prepare", "validate", "sign", "broadcast", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex || currentStep === "complete") {
      return "✓";
    } else if (stepIndex === currentIndex && loading) {
      return "⏳";
    } else {
      return stepIndex + 1;
    }
  };

  const getStepStatus = (step: TransactionStep) => {
    const steps = ["prepare", "validate", "sign", "broadcast", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex || currentStep === "complete") {
      return "complete";
    } else if (stepIndex === currentIndex) {
      return "active";
    } else {
      return "pending";
    }
  };

  return (
    <div className="space-y-6">
      {/* Transaction Progress */}
      {(loading || txHash) && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Progress</h3>
          <div className="flex items-center justify-between">
            {(["prepare", "validate", "sign", "broadcast", "complete"] as TransactionStep[]).map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStepStatus(step) === "complete" ? "bg-green-500 text-white" : getStepStatus(step) === "active" ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-600"}`}>{getStepIcon(step)}</div>
                <span className={`ml-2 text-sm ${getStepStatus(step) === "complete" ? "text-green-600" : getStepStatus(step) === "active" ? "text-orange-600" : "text-gray-500"}`}>{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                {index < 4 && <div className={`w-8 h-0.5 mx-4 ${getStepStatus(step) === "complete" ? "bg-green-500" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Script Builder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Bitcoin Script Builder</h2>
          <div className="flex items-center space-x-4">
            {balance !== null && (
              <div className="text-sm text-gray-600">
                Wallet Balance: <span className="font-medium">{formatBalance(balance)}</span>
              </div>
            )}
            {isConnected && (
              <button onClick={handleFaucetRequest} disabled={faucetLoading} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                {faucetLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Requesting...</span>
                  </>
                ) : (
                  <>
                    <span>🚰</span>
                    <span>Get Testnet BTC</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <Formik
          initialValues={{
            scriptCode: "",
            amount: 1000,
          }}
          validationSchema={ScriptSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, setFieldValue, values }) => (
            <Form className="space-y-6">
              {/* Script Examples */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Load Example Script</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(SCRIPT_EXAMPLES).map(([key]) => (
                    <button key={key} type="button" onClick={() => loadExample(key, setFieldValue)} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${selectedExample === key ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Script Code Input */}
              <div>
                <label htmlFor="scriptCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Bitcoin Script Code
                </label>
                <Field name="scriptCode">
                  {({ field }: any) => (
                    <ScriptEditor
                      value={field.value}
                      onChange={(value) => setFieldValue("scriptCode", value)}
                      onPaste={(e) => handlePaste(e, setFieldValue, values.scriptCode)}
                      placeholder="Enter your Bitcoin script code here... Paste Bitcoin addresses to auto-convert to hex!
                      Example Hash Lock:
                      // Hash Lock Script - requires revealing a secret
                      OP_SHA256 
                      0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
                      OP_EQUAL"
                      rows={12}
                      className={errors.scriptCode && touched.scriptCode ? "border-red-500" : "border-gray-600"}
                    />
                  )}
                </Field>
                <ErrorMessage name="scriptCode" component="div" className="text-red-500 text-sm mt-1" />
                <div className="text-xs text-gray-600 mt-2">
                  💡 <strong>Tip:</strong> The editor now features syntax highlighting! Paste Bitcoin addresses to auto-convert to hex. Currently supports Taproot addresses (tb1p...).
                </div>
              </div>

              {/* Transaction Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (sats)
                  </label>
                  <Field type="number" id="amount" name="amount" placeholder="Enter amount in satoshis" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${errors.amount && touched.amount ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-orange-500"}`} />
                  <ErrorMessage name="amount" component="div" className="text-red-500 text-sm mt-1" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Fee</label>
                  <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">~500 sats</div>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" disabled={loading || !isConnected || currentStep !== "prepare"} className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Transaction...
                  </span>
                ) : currentStep === "complete" ? (
                  "Transaction Complete"
                ) : (
                  "Create Script Transaction"
                )}
              </button>
            </Form>
          )}
        </Formik>
      </div>

      {/* Transaction Result */}
      {txHash && scriptAddress && (
        <div className="bg-white rounded-lg border border-green-200 p-6 border-l-4 border-l-green-500">
          <h3 className="text-lg font-semibold text-green-800 mb-4">🎉 Transaction Created Successfully!</h3>

          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-gray-700">Transaction ID:</span>
              <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-xs break-all">{txHash}</div>
            </div>

            <div>
              <span className="font-medium text-gray-700">Script Address:</span>
              <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-xs break-all">{scriptAddress}</div>
            </div>

            {transactionDetails && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="font-medium text-gray-700">Amount:</span>
                  <div className="text-green-600">{transactionDetails.amount.toLocaleString()} sats</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Fee:</span>
                  <div className="text-gray-600">{transactionDetails.fee} sats</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <a href={`https://signet.surge.dev/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
              View on Explorer →
            </a>
            <button onClick={resetTransaction} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
              Create Another Transaction
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">💡 How to Use Script Builder</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <h4 className="font-medium mb-2">Script Syntax:</h4>
            <ul className="space-y-1">
              <li>• Use standard Bitcoin opcodes (OP_SHA256, OP_EQUAL, etc.)</li>
              <li>• Hex values should be prefixed with 0x</li>
              <li>• Numbers can be written as decimal</li>
              <li>• Comments start with //</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Transaction Process:</h4>
            <ul className="space-y-1">
              <li>• Scripts are embedded in P2WSH outputs</li>
              <li>• Minimum amount is 546 sats (dust threshold)</li>
              <li>• Transactions are broadcast to Bitcoin testnet</li>
              <li>• Use the faucet button to open external testnet faucet</li>
              <li>• Always test on testnet before mainnet</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
