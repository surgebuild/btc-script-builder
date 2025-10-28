<div align="center">

# ₿ Bitcoin Script Builder

[![Live Demo](https://img.shields.io/badge/Live%20Demo-btc--script--builder.vercel.app-orange?style=for-the-badge&logo=vercel)](https://btc-script-builder.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-surgebuild%2Fbtc--script--builder-black?style=for-the-badge&logo=github)](https://github.com/surgebuild/btc-script-builder)
[![Twitter](https://img.shields.io/badge/Follow-%40surgebuild-1DA1F2?style=for-the-badge&logo=twitter)](https://x.com/surgebuild)

*A modern, interactive playground for creating and broadcasting Bitcoin script transactions on testnet*

**🚀 [Try it live](https://btc-script-builder.vercel.app) • 📚 [Documentation](#-usage) • 🐛 [Report Issues](https://github.com/surgebuild/btc-script-builder/issues)**

</div>

---

## ✨ Overview

Bitcoin Script Builder is a powerful, user-friendly web application that enables developers, researchers, and Bitcoin enthusiasts to create, test, and broadcast custom Bitcoin scripts on the Bitcoin testnet. Whether you're learning Bitcoin scripting, prototyping new ideas, or building complex multi-signature wallets, this tool provides an intuitive interface for script development.

### 🎯 Perfect for:
- **Developers** learning Bitcoin scripting and transaction creation
- **Researchers** experimenting with new script patterns and opcodes  
- **Educators** teaching Bitcoin scripting concepts
- **Protocol developers** prototyping new Bitcoin features

## 🚀 Features

- **Bitcoin Script Creation**: Write custom Bitcoin scripts using standard opcodes
- **Multiple Address Support**: Works with Taproot (P2TR), Native SegWit (P2WPKH), and Legacy addresses
- **Wallet Integration**: Connect with UniSat wallet for transaction signing
- **Testnet Faucet**: Built-in testnet faucet integration for getting test Bitcoin
- **Script Examples**: Pre-built examples including hash locks, timelocks, multisig, and puzzles
- **Real-time Progress**: Step-by-step transaction progress tracking
- **Transaction Explorer**: Direct links to view transactions on block explorers

## 🛠 Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.0.0-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.1.15-38B2AC?style=flat-square&logo=tailwind-css)
![bitcoinjs-lib](https://img.shields.io/badge/bitcoinjs--lib-7.0.0-F7931A?style=flat-square&logo=bitcoin)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)

</div>

- **🔧 Framework**: Next.js 16.0.0 with App Router and Turbopack
- **🎨 Styling**: Tailwind CSS v4 for modern, responsive design
- **₿ Bitcoin Library**: bitcoinjs-lib v7.0.0 for transaction handling
- **👛 Wallet Integration**: UniSat wallet for secure transaction signing
- **📝 Forms**: Formik with Yup validation for robust form handling
- **📱 Notifications**: Sonner for elegant toast messages
- **🌐 Network**: Bitcoin Testnet for safe experimentation

## 📋 Prerequisites

- Node.js 18+ 
- UniSat Wallet extension installed in your browser
- Testnet Bitcoin (use the built-in faucet button)

## 🚀 Getting Started

### 🔧 Local Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/surgebuild/btc-script-builder.git
cd btc-script-builder
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API endpoints:
```env
NEXT_PUBLIC_BTC_FAUCET_API=https://faucet.api.surge.dev
NEXT_PUBLIC_BTC_API=https://signet.surge.dev/api
NEXT_PUBLIC_BTC_ESPLORA_API=https://esplora.signet.surge.dev
```

4. **Run the development server:**
```bash
npm run dev
```

5. **Open your browser:**
Visit [http://localhost:3000](http://localhost:3000) to start building Bitcoin scripts!

### 🌐 Or try the live demo
Don't want to set up locally? **[Try the live version here →](https://btc-script-builder.vercel.app)**

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

We welcome contributions from the Bitcoin development community! Here's how you can help:

<div align="center">

[![Contributors](https://img.shields.io/github/contributors/surgebuild/btc-script-builder?style=for-the-badge)](https://github.com/surgebuild/btc-script-builder/graphs/contributors)
[![Issues](https://img.shields.io/github/issues/surgebuild/btc-script-builder?style=for-the-badge)](https://github.com/surgebuild/btc-script-builder/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/surgebuild/btc-script-builder?style=for-the-badge)](https://github.com/surgebuild/btc-script-builder/pulls)

</div>

### 💡 Ways to Contribute

- **🐛 Report bugs** - Found a bug? [Open an issue](https://github.com/surgebuild/btc-script-builder/issues/new)
- **✨ Suggest features** - Have an idea? We'd love to hear it!
- **📝 Improve documentation** - Help make our docs better
- **🔧 Code contributions** - Submit pull requests for new features or fixes
- **📚 Add script examples** - Share useful Bitcoin script patterns

### 🔄 Development Workflow

1. **Fork the repository** on GitHub
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes:** `git commit -m 'Add amazing feature'`
5. **Push to the branch:** `git push origin feature/amazing-feature`
6. **Submit a pull request** with a clear description

## 🌟 Community & Support

<div align="center">

[![GitHub Discussions](https://img.shields.io/badge/GitHub-Discussions-purple?style=for-the-badge&logo=github)](https://github.com/surgebuild/btc-script-builder/discussions)
[![Twitter Follow](https://img.shields.io/badge/Follow-%40surgebuild-1DA1F2?style=for-the-badge&logo=twitter)](https://x.com/surgebuild)

</div>

### 🆘 Getting Help

- **📖 Documentation**: Check our comprehensive guides above
- **💬 GitHub Discussions**: Ask questions and share ideas
- **🐛 Bug Reports**: [Create an issue](https://github.com/surgebuild/btc-script-builder/issues) with detailed information
- **📱 Social**: Follow [@surgebuild](https://x.com/surgebuild) for updates

When reporting issues, please include:
- Browser and wallet version
- Error messages and console logs
- Transaction IDs (if applicable)
- Steps to reproduce the issue

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## ⚠️ Important Disclaimer

**This tool is for educational and testing purposes only.** 

- ✅ Safe for Bitcoin **testnet** experimentation
- ❌ **Never use on mainnet** without thorough testing
- 🛡️ Always verify scripts before broadcasting
- 💼 Developers are not responsible for any loss of funds

**Remember:** Bitcoin transactions are irreversible. Test everything thoroughly on testnet first!

---

<div align="center">

**Built with ❤️ by [Surge](https://x.com/surgebuild)**

⭐ **Star this repo** if you found it helpful! • 🐦 **[Follow us](https://x.com/surgebuild)** for updates

</div>
