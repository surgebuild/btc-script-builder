# Bitcoin Script Builder

A modern Next.js application for creating and broadcasting Bitcoin script transactions on the testnet. This tool allows users to write custom Bitcoin scripts, create P2WSH (Pay to Witness Script Hash) transactions, and broadcast them to the Bitcoin testnet.

## 🚀 Features

- **Bitcoin Script Creation**: Write custom Bitcoin scripts using standard opcodes
- **Multiple Address Support**: Works with Taproot (P2TR), Native SegWit (P2WPKH), and Legacy addresses
- **Wallet Integration**: Connect with UniSat wallet for transaction signing
- **Testnet Faucet**: Built-in testnet faucet integration for getting test Bitcoin
- **Script Examples**: Pre-built examples including hash locks, timelocks, multisig, and puzzles
- **Real-time Progress**: Step-by-step transaction progress tracking
- **Transaction Explorer**: Direct links to view transactions on block explorers

## 🛠 Tech Stack

- **Framework**: Next.js 15.0.0 with Turbopack
- **Styling**: Tailwind CSS v4
- **Bitcoin Library**: bitcoinjs-lib v6.1.7
- **Wallet**: UniSat wallet integration
- **Forms**: Formik with Yup validation
- **Notifications**: Sonner for toast messages
- **Network**: Bitcoin Testnet

## 📋 Prerequisites

- Node.js 18+ 
- UniSat Wallet extension installed in your browser
- Testnet Bitcoin (use the built-in faucet button)

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bitcoin-script-builder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API endpoints:
```env
NEXT_PUBLIC_BTC_FAUCET_API=https://faucet.api.surge.dev
NEXT_PUBLIC_BTC_API=https://signet.surge.dev/api
NEXT_PUBLIC_BTC_ESPLORA_API=https://esplora.signet.surge.dev
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎯 Usage

### 1. Connect Your Wallet
- Click "Connect Wallet" to connect your UniSat wallet
- Make sure you're on Bitcoin Testnet
- Your wallet address and balance will be displayed

### 2. Get Testnet Bitcoin
- Click "Get Testnet BTC" to request funds from the faucet
- Wait a few minutes for the transaction to confirm

### 3. Create a Script Transaction

#### Choose a Script Example:
- **Hash Lock**: Requires revealing a secret (preimage)
- **Timelock**: Funds locked for a specific number of blocks
- **Multisig**: Multiple signatures required
- **Puzzle**: Mathematical puzzle requiring specific inputs

#### Or Write Your Own Script:
```
// Hash Lock Script Example
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL
```

#### Script Syntax:
- Use standard Bitcoin opcodes (OP_SHA256, OP_EQUAL, etc.)
- Hex values should be prefixed with `0x`
- Numbers can be written as decimal
- Comments start with `//`

### 4. Set Transaction Details
- **Amount**: Specify the amount in satoshis (minimum 546 sats)
- **Fee**: Automatically estimated (~500 sats)

### 5. Create Transaction
- Click "Create Script Transaction"
- Sign the transaction in your UniSat wallet
- Monitor the progress through the status indicators
- View your transaction on the block explorer

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/
│   └── ScriptBuilder.tsx  # Main script builder component
├── hooks/
│   ├── api.ts            # Bitcoin API functions
│   └── faucet.ts         # Faucet API integration
├── lib/
│   ├── context/
│   │   └── WalletContext.tsx  # Wallet state management
│   └── scriptUtils.ts    # Bitcoin script utilities
└── unisat.d.ts          # UniSat wallet type definitions
```

## 🔧 Key Components

### ScriptBuilder.tsx
Main component handling:
- Script input and validation
- Transaction creation workflow
- Progress tracking
- Error handling

### scriptUtils.ts
Core Bitcoin functionality:
- Script parsing and compilation
- PSBT creation and signing
- UTXO selection
- Transaction broadcasting

### WalletContext.tsx
Wallet state management:
- Connection status
- Balance tracking
- Public key retrieval

## 🧪 Script Examples

### Hash Lock Script
```javascript
OP_SHA256 
0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 
OP_EQUAL
```
Requires revealing the preimage of the hash to spend.

### Timelock Script
```javascript
144 
OP_CHECKSEQUENCEVERIFY 
OP_DROP 
OP_DUP 
OP_HASH160 
0x89abcdefabbaabbaabbaabbaabbaabbaabbaabba 
OP_EQUALVERIFY 
OP_CHECKSIG
```
Funds locked for 144 blocks (~24 hours).

### 2-of-3 Multisig
```javascript
OP_2 
0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798 
0x02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9 
0x03e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13 
OP_3 
OP_CHECKMULTISIG
```
Requires 2 out of 3 signatures to spend.

## 🔐 Security Considerations

- **Testnet Only**: This application is designed for Bitcoin testnet only
- **No Private Keys**: Private keys are handled by the UniSat wallet
- **Script Validation**: All scripts are validated before transaction creation
- **Error Handling**: Comprehensive error handling for failed transactions

## 🛠 Development

### Build for Production
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the existing issues on GitHub
2. Create a new issue with detailed information
3. Include error messages and transaction IDs if applicable

## ⚠️ Disclaimer

This tool is for educational and testing purposes only. Always test on testnet before using any Bitcoin script on mainnet. The developers are not responsible for any loss of funds.
