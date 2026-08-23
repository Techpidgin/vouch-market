import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signMessage: (message: Uint8Array, display?: "utf8") => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

const publicRpc = "https://api.mainnet-beta.solana.com";

function installBufferShim() {
  (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer;
}

function providerOrThrow() {
  if (!window.solana?.isPhantom) {
    throw new Error("Install and unlock Phantom to continue");
  }
  return window.solana;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function usdcStringToMicro(amountUsdc: string) {
  const normalized = String(amountUsdc ?? "").trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a valid USDC amount with up to six decimal places");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const micro = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0"));
  if (!Number.isSafeInteger(micro) || micro <= 0) throw new Error("The USDC amount is invalid");
  return micro;
}

export async function connectWallet() {
  const provider = providerOrThrow();
  const result = await provider.connect();
  return result.publicKey.toBase58();
}

export async function signWalletMessage(message: string) {
  const provider = providerOrThrow();
  const signature = await provider.signMessage(new TextEncoder().encode(message), "utf8");
  return toBase64(signature.signature);
}

export async function sendUsdcPayment(input: {
  recipientWallet: string;
  usdcMint: string;
  amountUsdc: string;
}) {
  installBufferShim();
  const {
    createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
  } = await import("@solana/spl-token");
  const provider = providerOrThrow();
  const connection = new Connection(publicRpc, "confirmed");
  const sender = provider.publicKey ?? (await provider.connect()).publicKey;
  const mint = new PublicKey(input.usdcMint);
  const recipient = new PublicKey(input.recipientWallet);
  const senderUsdc = await getAssociatedTokenAddress(mint, sender);
  const recipientUsdc = await getAssociatedTokenAddress(mint, recipient);
  const amount = usdcStringToMicro(input.amountUsdc);

  const transaction = new Transaction();
  const recipientAccount = await connection.getAccountInfo(recipientUsdc, "confirmed");
  if (!recipientAccount) {
    transaction.add(createAssociatedTokenAccountInstruction(sender, recipientUsdc, recipient, mint));
  }
  transaction.add(createTransferCheckedInstruction(senderUsdc, mint, recipientUsdc, sender, amount, 6));
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;
  const result = await provider.signAndSendTransaction(transaction);
  return result.signature;
}
