// Faucet API for getting testnet Bitcoin
const FAUCET_BASE = process.env.NEXT_PUBLIC_BTC_FAUCET_API?.replace(/\/$/, '') || "https://faucet.api.surge.dev";

export const requestFaucetFunds = async (address: string, amount: number = 10000) => {
  console.log("Requesting faucet funds for address:", address);
  console.log("Using faucet base URL:", FAUCET_BASE);
  
  try {
    // Use query parameter format like in the working curl
    const faucetUrl = `${FAUCET_BASE}/faucet?address=${encodeURIComponent(address)}`;
    console.log("Full faucet URL:", faucetUrl);
    
    const response = await fetch(faucetUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        "Referer": typeof window !== "undefined" ? window.location.origin : "http://localhost:3000/",
        "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"'
      },
      body: "",
    });
    
    console.log("Faucet response status:", response.status);
    console.log("Faucet response headers:", Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Faucet error response:", errorText);
      
      // Handle specific error cases
      if (response.status === 429) {
        throw new Error("Rate limited. Please wait before requesting again.");
      } else if (response.status === 400) {
        throw new Error("Invalid address or amount.");
      } else if (response.status === 403) {
        throw new Error("Access denied. This address may have already received funds recently.");
      } else if (response.status >= 500) {
        throw new Error("Faucet service temporarily unavailable. Please try again later.");
      }
      
      throw new Error(`Faucet request failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log("Faucet result:", result);
    return result;
  } catch (error) {
    console.error("Error requesting faucet funds:", error);
    
    // Check if it's a CORS error
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error("Network error: Unable to reach faucet service. This might be a CORS issue or the service is down.");
    }
    
    throw error;
  }
};

export const checkFaucetStatus = async () => {
  try {
    const response = await fetch(`${FAUCET_BASE}/status`);
    if (!response.ok) {
      throw new Error("Faucet unavailable");
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking faucet status:", error);
    throw error;
  }
};