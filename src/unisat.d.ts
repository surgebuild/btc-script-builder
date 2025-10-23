// Type declarations for UniSat wallet browser extension
interface Window {
    unisat?: {
        requestAccounts(): Promise<string[]>;
        getAccounts(): Promise<string[]>;
        getNetwork(): Promise<string>;
        switchNetwork(network: string): Promise<void>;
        getBalance(): Promise<{
            confirmed: number;
            unconfirmed: number;
            total: number;
        }>;
        createSendBitcoin(txParams: { to: string; amount: number }): Promise<string>;
        signPsbt(psbtHex: string, options?: { toSignInputs?: any[] }): Promise<string>;
        sendBitcoin(
            recipientAddress: string,
            amount: number,
            options?: { utxos?: Utxo[] }
        ): Promise<string>;
        getPublicKey(): Promise<string | null>;
        // Add other methods you use from UniSat here
    };
}