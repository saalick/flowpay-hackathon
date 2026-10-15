// FlowPay server entry point.
//
// Placeholder until the thin E2E slice (Task #4) lands. It exists so monorepo
// wiring and tsconfig are valid.
async function main() {
  const port = Number(process.env.PORT ?? 8787);
  console.log(`[flowpay/server] placeholder bootstrap on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
