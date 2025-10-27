// Simple API functions for Bitcoin testnet
const ESPLORA_BASE = (process.env.NEXT_PUBLIC_BTC_ESPLORA_API || "https://signet.surge.dev/api").replace(/\/$/, "");

// Helper function to build URLs without double slashes
const buildUrl = (base: string, path: string) => {
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  return `${cleanBase}/${cleanPath}`;
};

export const getUtxos = async (address: string) => {
  console.log("Fetching UTXOs for address:", address);

  try {
    const url = buildUrl(ESPLORA_BASE, `/address/${address}/utxo`);
    console.log("UTXO fetch URL:", url);

    const response = await fetch(url);
    console.log("UTXO fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("UTXO fetch error:", errorText);
      throw new Error(`Failed to fetch UTXOs: ${response.status} ${errorText}`);
    }

    const utxos = await response.json();
    console.log("UTXOs received:", utxos.length);

    // Filter out small UTXOs that might cause dust issues
    const filteredUtxos = utxos.filter((utxo: any) => utxo.value >= 546);
    console.log("Filtered UTXOs (>=546 sats):", filteredUtxos.length);

    return filteredUtxos;
  } catch (error) {
    console.error("Error fetching UTXOs:", error);
    throw error;
  }
};

export const pushTx = async (txHex: string) => {
  console.log("Broadcasting transaction, hex length:", txHex.length);

  try {
    const url = buildUrl(ESPLORA_BASE, "/tx");
    console.log("Broadcast URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: txHex,
    });

    console.log("Broadcast response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Broadcast error:", errorText);
      throw new Error(`Failed to broadcast transaction: ${response.status} ${errorText}`);
    }

    const txid = await response.text();
    console.log("Transaction broadcast successfully, txid:", txid);
    return txid;
  } catch (error) {
    console.error("Error broadcasting transaction:", error);
    throw error;
  }
};

export const fetchBalance = async (address: string) => {
  console.log("Fetching balance for address:", address);

  try {
    const url = buildUrl(ESPLORA_BASE, `/address/${address}`);
    console.log("Balance fetch URL:", url);

    const response = await fetch(url);
    console.log("Balance fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Balance fetch error:", errorText);
      throw new Error(`Failed to fetch balance: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const balance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    console.log("Balance fetched:", balance);
    return balance;
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw error;
  }
};

// Get transaction details to reveal scripts
export const getTransaction = async (txid: string) => {
  console.log("Fetching transaction:", txid);

  try {
    const url = buildUrl(ESPLORA_BASE, `/tx/${txid}`);
    console.log("Transaction fetch URL:", url);

    const response = await fetch(url);
    console.log("Transaction fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transaction fetch error:", errorText);
      throw new Error(`Failed to fetch transaction: ${response.status} ${errorText}`);
    }

    const txData = await response.json();
    console.log("Transaction fetched:", txid);
    return txData;
  } catch (error) {
    console.error("Error fetching transaction:", error);
    throw error;
  }
};

// Get address transactions to find script usage
export const getAddressTransactions = async (address: string) => {
  console.log("Fetching transactions for address:", address);

  try {
    const url = buildUrl(ESPLORA_BASE, `/address/${address}/txs`);
    console.log("Address txs fetch URL:", url);

    const response = await fetch(url);
    console.log("Address txs fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Address txs fetch error:", errorText);
      throw new Error(`Failed to fetch address transactions: ${response.status} ${errorText}`);
    }

    const txs = await response.json();
    console.log("Address transactions fetched:", txs.length);
    return txs;
  } catch (error) {
    console.error("Error fetching address transactions:", error);
    throw error;
  }
};
