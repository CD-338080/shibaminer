const fs = require('fs');

function patch(path, extra = (c) => c) {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(/import DogeCoin from '@\/icons\/DogeCoin';/g, "import ShibaCoin from '@/icons/ShibaCoin';");
  c = c.replace(/\bDogeCoin\b/g, 'ShibaCoin');
  c = c.replace(/\bDogeToken\b/g, 'ShibaToken');
  c = c.replace(/\bisValidDogeAddress\b/g, 'isValidShibAddress');
  c = c.replace(/Daily Doge/g, 'Shiba Miner');
  c = c.replace(/Dogecoin/g, 'Shiba Inu');
  c = c.replace(/\bDOGE\b/g, 'SHIB');
  c = c.replace(/doge-payouts/g, 'doge-payouts'); // keep API route name for now
  c = extra(c);
  fs.writeFileSync(path, c, 'utf8');
  console.log('patched', path);
}

patch('D:/ESCRITORIO/Shiba_Inu_Miner_Pro/components/Airdrop.tsx', (c) => {
  c = c.replace(
    /const MINER_WALLET_URL =\s*'https:\/\/blockchair\.com\/dogecoin\/address\/[^']+';/,
    `const MINER_WALLET_URL =
  process.env.NEXT_PUBLIC_SHIB_EXPLORER_ADDRESS ||
  'https://etherscan.io/token/0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce';`
  );
  c = c.replace(
    /tx\.explorerUrl \|\| `https:\/\/blockchair\.com\/dogecoin\/transaction\/\$\{tx\.txid\}`/g,
    "tx.explorerUrl || `https://etherscan.io/tx/${tx.txid}`"
  );
  c = c.replace(
    /`https:\/\/blockchair\.com\/dogecoin\/transaction\/\$\{latestPayout\.txid\}`/g,
    '`https://etherscan.io/tx/${latestPayout.txid}`'
  );
  c = c.replace(/Verify on Shiba Inu blockchain/g, 'Verify on-chain');
  c = c.replace(/Failed to fetch Shiba Inu transactions/g, 'Failed to fetch SHIB transactions');
  // Dark-ish text tokens used on cream UI → paper/ember for consistency when we keep structure
  c = c.replace(/text-\[#2b1d0e\]/g, 'text-[#f4ebe3]');
  c = c.replace(/text-\[#8b6914\]/g, 'text-[#9a8f86]');
  c = c.replace(/text-\[#c47a0a\]/g, 'text-[#ff6b1a]');
  c = c.replace(/text-\[#0284c7\]/g, 'text-[#ff6b1a]');
  c = c.replace(/text-\[#6b5424\]/g, 'text-[#9a8f86]');
  c = c.replace(/text-\[#5c3d06\]/g, 'text-[#9a8f86]');
  return c;
});

patch('D:/ESCRITORIO/Shiba_Inu_Miner_Pro/components/popups/WithdrawPopup.tsx', (c) => {
  c = c.replace(
    /\/\*\* Shiba Inu P2PKH: starts with D, 34 chars, Base58 \(no 0 O I l\) \*\/\s*function isValidShibAddress\(address: string\) \{\s*return \/\^D\[1-9A-HJ-NP-Za-km-z\]\{33\}\$\/\.test\(address\.trim\(\)\);\s*\}/,
    `/** SHIB (ERC-20) Ethereum address */\nfunction isValidShibAddress(address: string) {\n  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());\n}`
  );
  // If previous replace didn't catch (Dogecoin already became Shiba Inu in comment differently)
  if (c.includes('starts with D, 34 chars')) {
    c = c.replace(
      /function isValidShibAddress\(address: string\) \{\s*return \/\^D\[1-9A-HJ-NP-Za-km-z\]\{33\}\$\/\.test\(address\.trim\(\)\);\s*\}/,
      `function isValidShibAddress(address: string) {\n  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());\n}`
    );
  }
  c = c.replace(/Valid SHIB address/g, 'Valid SHIB (ERC-20) address');
  c = c.replace(/Invalid SHIB address/g, 'Invalid ERC-20 address');
  c = c.replace(/Shiba Inu network only/g, 'Ethereum network · SHIB (ERC-20) only');
  c = c.replace(/on the Shiba Inu network/g, 'as SHIB on Ethereum');
  c = c.replace(/Enter the Shiba Inu address/g, 'Enter the Ethereum address');
  return c;
});
