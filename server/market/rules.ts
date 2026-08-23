export function enforceUnder1kMinimum(vouchBand: string, pricePerVouch: number) {
  if (!Number.isFinite(pricePerVouch) || pricePerVouch <= 0) {
    throw new Error("Price per vouch must be greater than zero");
  }
  if (vouchBand === "under_1k" && pricePerVouch < 0.5) {
    throw new Error("Requests under 1k must offer at least 0.50 USDC per vouch");
  }
}

export function enforceAvailableFill(remainingQuantity: number, fillQuantity: number) {
  if (!Number.isInteger(fillQuantity) || fillQuantity <= 0) {
    throw new Error("Fill quantity must be a positive whole number");
  }
  if (fillQuantity > remainingQuantity) {
    throw new Error("This fill exceeds the remaining request quantity");
  }
}

export function assertUnusedPaymentSignature(signatureAlreadyUsed: boolean) {
  if (signatureAlreadyUsed) {
    throw new Error("This payment signature has already been used");
  }
}

export function enforceWalletOwnership(expectedWallet: string, submittedWallet: string) {
  if (expectedWallet !== submittedWallet) {
    throw new Error("This wallet is not authorized for the selected record");
  }
}

export function nextRequestStatusAfterCompletions(input: {
  requestedQuantity: number;
  filledQuantity: number;
  buyerMarkedDone: boolean;
  sellerMarkedDone: boolean[];
}) {
  const requestIsFull = input.filledQuantity === input.requestedQuantity;
  const everySellerMarkedDone = input.sellerMarkedDone.length > 0 && input.sellerMarkedDone.every(Boolean);
  return requestIsFull && input.buyerMarkedDone && everySellerMarkedDone ? "awaiting_review" : "filled";
}

export function nextRequestStatusAfterPayouts(statuses: Array<"paid" | "disputed" | "under_review">) {
  if (statuses.some(status => status === "disputed")) return "disputed";
  if (statuses.length > 0 && statuses.every(status => status === "paid")) return "completed";
  return "awaiting_review";
}
