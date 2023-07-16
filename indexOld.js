const express = require('express');
const {ethers} =require('ethers');
const IUniswapV3PoolABI  = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const FactoryABI = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
const fs = require("fs");
const {promisify} =require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const app = express();
const port = 3000;



//Constants

const POOL_FACTORY_CONTRACT_ADDRESS= '0x1F98431c8aD98523631AE4a59f267346ea31F984'; 

const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth');

const factoryContract = new ethers.Contract(POOL_FACTORY_CONTRACT_ADDRESS,FactoryABI.abi,provider);
//Config



// First BLOCK - #12369621

async function getPrice(token0, token1, amount, sqrtP) {
  // Calculate quoteAmount
  const ratioX192 = BigInt(sqrtP);
  const baseAmount = BigInt(amount) * (BigInt(10) ** BigInt(18));
  const shift = BigInt(1) << BigInt(192);
  const quoteAmount = ((ratioX192 * baseAmount) + (shift / BigInt(2))) / shift;

  // Convert quoteAmount to desired unit (assuming quoteTokenDecimals)
  const quoteAmountInDesiredUnit = parseFloat(quoteAmount.toString()) / (10 ** 6);
  console.log(quoteAmountInDesiredUnit);
}



// Define a route for the homepage
app.get('/', async (req, res) => {
  const poolAdd = await factoryContract.getPool('0x6B175474E89094C44Da98b954EedeAC495271d0F','0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',500);
  const pool = new ethers.Contract(poolAdd,IUniswapV3PoolABI.abi,provider);
  const slot0 =await pool.slot0();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const tick = slot0[1];
  const hexValue = slot0[0]._hex;
  // const decimalValue = ethers.BigNumber.from(hexValue).toString();
  const bigNumber = ethers.BigNumber.from(hexValue);
  const squaredValue = bigNumber.mul(bigNumber).toString();
  getPrice(token0,token1,1,squaredValue);
  console.log();
  res.send( {squaredValue,tick,token0,token1,hexValue});
});

// Start the server
app.listen(port, () => {
    // console.log(contract);

  console.log(`Server is listening on port ${port}`);
});
// Route to get all values in the mapping
app.get('/getPool', async (req, res) => {

  const limit = 12369621;
  const latestBlockNumber = await provider.getBlockNumber();
  const fl = latestBlockNumber - 10000;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  
  const processBlocks = async () => {
    let l = 12369620;
    let r = l - 2000;
    while ((l) >= limit) {
      
      console.log(`Last Block was: ${l}`);
      const filter = {
        address: POOL_FACTORY_CONTRACT_ADDRESS,
        fromBlock: r,
        toBlock: l,
      };

      const logs = await provider.getLogs(filter);
      const poolMapping = {};
      await mapPool(poolMapping, logs);
      await writeMapping(poolMapping);
      if((l-2000)<=limit){
        l=limit;
      }else{
        l-=2001;
      }
      r -= 2001;

      // Delay for a certain period before processing the next block range
      await delay(1000); // Adjust the delay as needed
    }

    res.json("Computing completed");
  };

  processBlocks();
});

//Last iterated Block 12372182

function mapPool(poolMapping, logs) {
  for (const log of logs) {
    console.log(log);
    const data = log.data;
    const currPool = '0x' + data.substr(-40);
    const tick = data.substr(-66,2);
    const token0 = '0x' + log.topics[1].substr(-40);
    const token1 = '0x' + log.topics[2].substr(-40);

    const key = [token0, token1,tick];
    poolMapping[key] = currPool;

    // You can use the pair of constants as the key here for further processing
    console.log({ token0, token1, currPool });
  }
}


async function writeMapping(poolMapping) {
  console.log({ poolMapping });

  let existingMapping = {};
  try {
    const fileContent = await readFileAsync('mapping.json', 'utf8');
    existingMapping = JSON.parse(fileContent);
  } catch (err) {
    // Ignore the error if the file doesn't exist or is empty
  }

  const updatedMapping = { ...existingMapping, ...poolMapping };

  try {
    await writeFileAsync('mapping.json', JSON.stringify(updatedMapping, null, 2), { flag: 'a' });
    console.log('Mapping results have been appended to mapping.json');
  } catch (err) {
    console.error('Error writing to file:', err);
  }
}