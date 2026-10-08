// === QMS Testnet Configuration ===
const QMS_CHAIN_ID = 19480;
const QMS_CHAIN_ID_HEX = "0x4c18";
const QMS_RPC_URL = "https://rpc.testnet.qms.finance";
const QMS_EXPLORER_URL = "https://explorer.testnet.qms.finance";

// === Sample Storage Contract ===
const STORAGE_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "num", type: "uint256" }],
    name: "store",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "retrieve",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const STORAGE_BYTECODE =
  "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220322c78243e61b783558509c9cc22cb8493dde6925aa5e89a08cdf6e22f279ef164736f6c63430008120033";

// === DOM Elements ===
const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const connectBtn = $("connectBtn");
const disconnectBtn = $("disconnectBtn");
const walletBadge = $("walletBadge");
const walletInfo = $("walletInfo");
const accountText = $("accountText");
const networkText = $("networkText");
const balanceText = $("balanceText");
const switchBtn = $("switchBtn");
const deployCard = $("deployCard");
const deployBtn = $("deployBtn");
const deployHint = $("deployHint");
const resultEl = $("result");
const contractAddressEl = $("contractAddress");
const txLink = $("txLink");
const explorerLink = $("explorerLink");
const walletModal = $("walletModal");
const walletList = $("walletList");
const closeModalBtn = $("closeModal");

// === State ===
let provider = null;
let signer = null;
let currentAccount = null;
let currentChainId = null;
let activeProvider = null;

// === Helpers ===
function showStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

function setButtonLoading(btn, text) {
  btn.disabled = true;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon spinner">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none"></path>
    </svg>
    <span>${text}</span>
  `;
}

// === Wallet Detection ===
function detectWallets() {
  const wallets = [];
  const seen = new Set();

  const addWallet = (name, p) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    wallets.push({ name, provider: p });
  };

  if (window.okxwallet) {
    addWallet("OKX Wallet", window.okxwallet);
  }

  if (window.ethereum) {
    if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
      window.ethereum.providers.forEach((p) => {
        if (p.isRabby) addWallet("Rabby Wallet", p);
        else if (p.isMetaMask && !p.isBraveWallet) addWallet("MetaMask", p);
        else if (p.isCoinbaseWallet) addWallet("Coinbase Wallet", p);
        else if (p.isTrust || p.isTrustWallet) addWallet("Trust Wallet", p);
        else if (p.isBraveWallet) addWallet("Brave Wallet", p);
        else if (p.isFrame) addWallet("Frame", p);
        else addWallet("Injected Wallet", p);
      });
    } else {
      const p = window.ethereum;
      if (p.isRabby) addWallet("Rabby Wallet", p);
      else if (p.isMetaMask && !p.isBraveWallet) addWallet("MetaMask", p);
      else if (p.isCoinbaseWallet) addWallet("Coinbase Wallet", p);
      else if (p.isTrust || p.isTrustWallet) addWallet("Trust Wallet", p);
      else if (p.isBraveWallet) addWallet("Brave Wallet", p);
      else if (p.isFrame) addWallet("Frame", p);
      else addWallet("Injected Wallet", p);
    }
  }

  return wallets;
}

// === Wallet Selector Modal ===
function showWalletSelector(wallets) {
  walletList.innerHTML = "";

  wallets.forEach((w) => {
    const btn = document.createElement("button");
    btn.className = "wallet-option";
    btn.type = "button";
    btn.innerHTML = `
      <span class="wallet-name">${w.name}</span>
      <span class="wallet-arrow">→</span>
    `;
    btn.addEventListener("click", () => {
      walletModal.classList.add("hidden");
      connectWallet(w.provider);
    });
    walletList.appendChild(btn);
  });

  walletModal.classList.remove("hidden");
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    walletModal.classList.add("hidden");
  });
}

if (walletModal) {
  walletModal.addEventListener("click", (e) => {
    if (e.target === walletModal) {
      walletModal.classList.add("hidden");
    }
  });
}

// === Connect Wallet ===
async function connectWallet(selectedProvider = null) {
  try {
    hideStatus();

    const wallets = detectWallets();

    if (wallets.length === 0) {
      showStatus(
        "error",
        "No EVM wallet detected. Please install MetaMask, Rabby, OKX Wallet, or another EVM-compatible wallet."
      );
      return;
    }

    let chosen = selectedProvider;
    if (!chosen) {
      if (wallets.length === 1) {
        chosen = wallets[0].provider;
      } else {
        showWalletSelector(wallets);
        return;
      }
    }

    activeProvider = chosen;
    setButtonLoading(connectBtn, "Connecting...");

    provider = new ethers.BrowserProvider(chosen);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    currentAccount = await signer.getAddress();

    const network = await provider.getNetwork();
    currentChainId = Number(network.chainId);

    if (currentChainId !== QMS_CHAIN_ID) {
      await switchToQMS(chosen);
      return;
    }

    await updateUI();
    showStatus("success", `Wallet connected: ${shortAddr(currentAccount)}`);
  } catch (err) {
    console.error(err);
    let msg = err.message || "An error occurred while connecting the wallet.";
    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      msg = "Rejected by user.";
    }
    showStatus("error", msg);
  } finally {
    resetConnectBtn();
  }
}

function resetConnectBtn() {
  connectBtn.disabled = false;
  connectBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
    <span>Connect Wallet</span>
  `;
}

// === Disconnect Wallet ===
async function disconnectWallet() {
  try {
    // Bəzi cüzdanlar (MetaMask) wallet_revokePermissions dəstəkləyir
    if (activeProvider && activeProvider.request) {
      try {
        await activeProvider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (e) {
        // Bəzi cüzdanlar bu metodu dəstəkləmir — sükutla keç
        console.warn("wallet_revokePermissions not supported:", e);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    // Yerli vəziyyəti sıfırla
    provider = null;
    signer = null;
    currentAccount = null;
    currentChainId = null;
    activeProvider = null;

    // UI-ı sıfırla
    walletBadge.classList.add("hidden");
    walletInfo.classList.add("hidden");
    connectBtn.classList.remove("hidden");
    switchBtn.classList.add("hidden");
    deployCard.classList.add("disabled");
    deployBtn.disabled = true;
    deployHint.textContent = "Connect your wallet first to deploy.";
    deployHint.classList.remove("error");
    resultEl.classList.add("hidden");

    showStatus("info", "Wallet disconnected.");
    setTimeout(() => hideStatus(), 2500);
  }
}

// === Switch to QMS Testnet ===
async function switchToQMS(selectedProvider) {
  const eth = selectedProvider || activeProvider || window.ethereum;
  if (!eth) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: QMS_CHAIN_ID_HEX }],
    });
    setTimeout(() => window.location.reload(), 500);
  } catch (switchError) {
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: QMS_CHAIN_ID_HEX,
              chainName: "QMS Testnet",
              nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
              rpcUrls: [QMS_RPC_URL],
              blockExplorerUrls: [QMS_EXPLORER_URL],
            },
          ],
        });
        setTimeout(() => window.location.reload(), 500);
      } catch (addError) {
        console.error(addError);
        showStatus("error", "Failed to add QMS Testnet. Please check the Chain ID and RPC URL.");
      }
    } else {
      console.error(switchError);
      showStatus("error", "Failed to switch to QMS Testnet.");
    }
  }
}

// === Update UI ===
async function updateUI() {
  if (!currentAccount) return;

  walletBadge.classList.remove("hidden");
  walletInfo.classList.remove("hidden");
  connectBtn.classList.add("hidden");

  accountText.textContent = shortAddr(currentAccount);
  accountText.classList.add("mono");

  const isQMS = currentChainId === QMS_CHAIN_ID;
  networkText.textContent = isQMS ? "QMS Testnet" : `Chain ID: ${currentChainId}`;
  networkText.className = `info-value ${isQMS ? "success" : "error"}`;

  try {
    const bal = await provider.getBalance(currentAccount);
    balanceText.textContent = `${parseFloat(ethers.formatEther(bal)).toFixed(4)} QMS`;
  } catch {
    balanceText.textContent = "—";
  }

  if (isQMS) {
    switchBtn.classList.add("hidden");
    deployCard.classList.remove("disabled");
    deployBtn.disabled = false;
    deployHint.textContent = "MetaMask will open and ask for confirmation.";
    deployHint.classList.remove("error");
  } else {
    switchBtn.classList.remove("hidden");
    deployCard.classList.add("disabled");
    deployBtn.disabled = true;
    deployHint.textContent = "Switch to QMS Testnet to deploy.";
    deployHint.classList.add("error");
  }
}

// === Deploy Contract ===
async function deployContract() {
  if (!signer || currentChainId !== QMS_CHAIN_ID) {
    showStatus("error", "Please connect your wallet and switch to QMS Testnet first.");
    return;
  }

  try {
    hideStatus();
    resultEl.classList.add("hidden");
    setButtonLoading(deployBtn, "Deploying...");
    showStatus("info", "Deploying contract... Confirm in your wallet.");

    const factory = new ethers.ContractFactory(STORAGE_ABI, STORAGE_BYTECODE, signer);
    const contract = await factory.deploy();

    const tx = contract.deploymentTransaction();
    const hash = tx ? tx.hash : null;

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    contractAddressEl.textContent = address;
    if (hash) {
      txLink.textContent = hash;
      txLink.href = `${QMS_EXPLORER_URL}/tx/${hash}`;
    } else {
      txLink.textContent = "—";
      txLink.removeAttribute("href");
    }
    explorerLink.href = `${QMS_EXPLORER_URL}/address/${address}`;
    resultEl.classList.remove("hidden");

    showStatus("success", "✅ Contract deployed successfully!");
    updateUI();
  } catch (err) {
    console.error(err);
    let msg = err.message || "An error occurred while deploying the contract.";
    if (err.code === 4001 || err.code === "ACTION_REJECTED") {
      msg = "Rejected by user.";
    }
    showStatus("error", msg);
  } finally {
    resetDeployBtn();
  }
}

function resetDeployBtn() {
  deployBtn.disabled = false;
  deployBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
    <span>Deploy Contract</span>
  `;
}

// === Event Listeners ===
connectBtn.addEventListener("click", () => connectWallet());
disconnectBtn.addEventListener("click", disconnectWallet);
switchBtn.addEventListener("click", () => switchToQMS(activeProvider));
deployBtn.addEventListener("click", deployContract);

// === Auto-connect ===
async function autoConnect() {
  const wallets = detectWallets();
  if (wallets.length === 0) return;

  for (const w of wallets) {
    try {
      const accounts = await w.provider.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        await connectWallet(w.provider);
        return;
      }
    } catch {
      // keç
    }
  }
}

function attachProviderEvents(eth) {
  if (!eth || !eth.on) return;
  eth.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) {
      // İstifadəçi cüzdandan çıxdı
      disconnectWallet();
    } else {
      connectWallet(activeProvider);
    }
  });
  eth.on("chainChanged", () => {
    window.location.reload();
  });
}

window.addEventListener("load", () => {
  autoConnect();

  if (window.ethereum) attachProviderEvents(window.ethereum);
  if (window.okxwallet && window.okxwallet !== window.ethereum) {
    attachProviderEvents(window.okxwallet);
  }
});