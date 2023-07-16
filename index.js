const express = require('express');
const axios = require('axios');
const poolData = require('./mapping.json');
const {ethers} =require('ethers');
const app = express();
const PORT = 3001;
const endpoint = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
const tokenToPool = new Map(Object.entries(poolData));
const fs = require("fs");
const {promisify} =require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const Quoter = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json');
const { abi: Quoter2Abi } = require('@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json')

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

//Consts
const QUOTER_CONTRACT_ADDRESS ='0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
const QUOTER2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth');
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const quoterContract = new ethers.Contract(
  QUOTER2_ADDRESS,
  Quoter2Abi,
  provider
)

const quoterContract1 = new ethers.Contract(
  QUOTER_CONTRACT_ADDRESS,
  Quoter.abi,
  provider
)

//Quoter Swap 
const swap = async (tokenIn, tokenOut, fee, amountIn) => {
  try {
    const amountOut = await quoterContract1.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      0
    );
    return amountOut;
  } catch (error) {
  }
}

//Get pool data with pool Address
async function getPoolPrice(id) {
  const response = await axios({
    url: endpoint,
    method: 'post',
    data: {
      query: `
      {
        pool(id: "${id}") {
          id
          sqrtPrice
          feeTier
          token0{
            id
            symbol
            decimals
          }
          token1{
            id
            symbol
            decimals
          }
        }
      }
      `
    }
  });

  const result = response.data;
  // console.log(result);
  return result;
}

//Forward Swap function
async function forwardSwap(value,amount,num){
  if( value===undefined) return '0';
  if(amount===undefined) return '0';
  const pool =await getPoolPrice(value);
  const token0=pool.data.pool.token0.id;
  const token1=pool.data.pool.token1.id;
  if(token1==token0) return '0';
  const fee=pool.data.pool.feeTier;
  const amountIn = ethers.utils.parseUnits(amount,pool.data.pool.token0.decimals);
  if (!ethers.BigNumber.isBigNumber(amountIn)) return '0';
  const amountOut= await swap(token0,token1,fee,amountIn);
  if( amountOut===undefined) return '0';

  let formattedAmount;
  if (ethers.BigNumber.isBigNumber(amountOut)) {
    formattedAmount = ethers.utils.formatUnits(amountOut, pool.data.pool.token1.decimals);
  } else {
       formattedAmount = '0'; // Default value if amountOut is not a BigNumber
  }

  // console.log(" A " + amount + " T " + token0 +"---> A " + formattedAmount +" T " + token1 + "  " + num);

  return formattedAmount;
}

//Backward Swap Function
async function backwardSwap(value,amount,num){
  if( value===undefined) return '0';
  if( amount===undefined) return '0';
  const pool =await getPoolPrice(value);
  const token0=pool.data.pool.token1.id;
  const token1=pool.data.pool.token0.id;
  if(token1==token0) return '0';
  const fee=pool.data.pool.feeTier;
  const amountIn = ethers.utils.parseUnits(amount,pool.data.pool.token1.decimals);
  if (!ethers.BigNumber.isBigNumber(amountIn)) return '0';
  const amountOut = await swap(token0,token1,fee,amountIn);
  if( amountOut===undefined) return '0';

  let formattedAmount;
  if (ethers.BigNumber.isBigNumber(amountOut)) {
    formattedAmount = ethers.utils.formatUnits(amountOut, pool.data.pool.token0.decimals);
  } else {
       formattedAmount = '0'; // Default value if amountOut is not a BigNumber
  }
  return formattedAmount;
  // console.log(" A " + amount + " T " + token0 +"---> A " + formattedAmount +" T " + token1 + "  " + num);
}





startArb();


// Main Arb Function
async function startArb(){
  
  // First Token to Begin With 
  const searchAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const startAmount=10;
  for (const [key,value] of tokenToPool) {
  
    // Condition here to check for forward or backward swap
    if (key.includes(searchAddress)) {
      //To check if the pool has starting token as first token
        if(key.substring(0,42)==searchAddress){
          //Get pool data
          const pool =await getPoolPrice(value);
          const token0=pool.data.pool.token0.id;
          const token1=pool.data.pool.token1.id;
          const fee=pool.data.pool.feeTier;

          //Formating The AmountIn to correct decimals for the Token0
          const amountIn = ethers.BigNumber.from(startAmount).pow(pool.data.pool.token0.decimals);
          if (!ethers.BigNumber.isBigNumber(amountIn)) continue;
          const amountOut= await swap(token0,token1,fee,amountIn);
          if(typeof amountOut===undefined) return '0';
          var formattedAmount;
          //Formatting output amount
          if (ethers.BigNumber.isBigNumber(amountOut)) {
            formattedAmount = ethers.utils.formatUnits(amountOut, pool.data.pool.token1.decimals);
          } else {
               formattedAmount = '0'; // Default value if amountOut is not a BigNumber
          }
          if(formattedAmount=='0') continue;
          //For 2nd SWAP
          for(const [key2,value2] of tokenToPool){
            if (key2.includes(token1.toString())) {

              if(key2.substring(0,42)==token1){
                const token1_2 = key2.substring(43,85);
                const formattedAmount_2 = await forwardSwap(value2,formattedAmount,2);
                if(formattedAmount_2=='0') continue;
                //Final Swap

                // To Find the final pool we will use starting token and output token of 2nd swap to find the pool
                const tick = ["01","0a","3c","38"];

                // Iterating over all ticks to find possible pools
                for(let k=0;k<4;k++){
                  let s = token1_2+','+token0+','+tick[k];
                  let s1 = token0+','+token1_2+','+tick[k];
                  //Forward Swap
                  if(tokenToPool.has(s)){
                    const formattedAmount_3 = await forwardSwap(tokenToPool.get(s),formattedAmount_2,3);
                    if(formattedAmount_3=='0') continue;
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  //Backward Swap
                  }else if(tokenToPool.has(s1)){
                    const formattedAmount_3 = await backwardSwap(tokenToPool.get(s1),formattedAmount_2,3);
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  }
                }
              }else{
                //Backward Swap
                const formattedAmount_2 =  await backwardSwap(value2,formattedAmount,2);
                const token1_2=key2.substring(0,42);
               if(formattedAmount_2=='0') continue;

                //Final Swap
                const tick = ["01","0a","3c","38"];
                for(let k=0;k<4;k++){

                  let s = token1_2+','+token0+','+tick[k];
                  let s1 = token0+','+token1_2+','+tick[k]

                  //Forward Swap
                  if(tokenToPool.has(s)){
                    const formattedAmount_3 = await forwardSwap(tokenToPool.get(s),formattedAmount_2,3);
                    
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3); }
                     //Backward Swap
                     else if(tokenToPool.has(s1)){
                    
                      const formattedAmount_3 = await backwardSwap(tokenToPool.get(s1),formattedAmount_2,3);
                    
                      console.log("Tri SWAP");
                      console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                      console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                      console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  }
                }
              }
              
            
          }else{
            // No pool
            
          }
          }
        }else{
          //Backward Swap
          const pool =await getPoolPrice(value);
          const token0=pool.data.pool.token1.id;
          const token1=pool.data.pool.token0.id;
          const fee=pool.data.pool.feeTier;
          const amountIn = ethers.BigNumber.from(startAmount).pow(pool.data.pool.token1.decimals);
          if (!ethers.BigNumber.isBigNumber(amountIn)) continue;
          const amountOut = await swap(token0,token1,fee,amountIn);
          if(typeof amountOut===undefined) return '0';
          let formattedAmount;
          if (ethers.BigNumber.isBigNumber(amountOut)) {
            formattedAmount = ethers.utils.formatUnits(amountOut, pool.data.pool.token0.decimals);
          } else {
               formattedAmount = '0'; // Default value if amountOut is not a BigNumber
          }
          if(formattedAmount=='0') continue;
          for(const [key2,value2] of tokenToPool){
            if (key2.includes(token1.toString())) {
              if(key2.substring(0,42)==token1){
                //Forward Swap
                const token1_2 = key2.substring(43,85);
                const formattedAmount_2 = await forwardSwap(value2,formattedAmount,2);
                if(formattedAmount_2=='0') continue;
                
                //Final Swap
                const tick = ["01","0a","3c","38"];
                for(let k=0;k<4;k++){
                  let s = token1_2+','+token0+','+tick[k];
                  let s1 = token0+','+token1_2+','+tick[k]
                  if(tokenToPool.has(s)){
                    //Forward Swap
                    const formattedAmount_3 = await forwardSwap(tokenToPool.get(s),formattedAmount_2,3);
                    
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);  }
                  //Backward Swap
                  else if(tokenToPool.has(s1)){
                    const formattedAmount_3 = await backwardSwap(tokenToPool.get(s1),formattedAmount_2,3);
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  }
                }
              }else{
                const token1_2 = key2.substring(0,42);
                const formattedAmount_2=await backwardSwap(value2,formattedAmount,2);
                if(formattedAmount_2=='0') continue;

                //Final Swap
                const tick = ["01","0a","3c","38"];
                for(let k=0;k<4;k++){

                  let s = token1_2+','+token0+','+tick[k];
                  let s1 = token0+','+token1_2+','+tick[k];
                  if(tokenToPool.has(s)){
                   
                    const formattedAmount_3 = await forwardSwap(tokenToPool.get(s),formattedAmount_2,3);
                
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  }else if(tokenToPool.has(s1)){
                    console.log("v2");
                    const formattedAmount_3 =  await backwardSwap(tokenToPool.get(s1),formattedAmount_2,3);
                    console.log("Tri SWAP");
                    console.log("1st Swap = 1 "+token0+"-->"+token1+" "+formattedAmount);
                    console.log("2nd Swap= "+formattedAmount + " "+token1+"-->"+token1_2+" "+formattedAmount_2);
                    console.log("3rd Swap= "+formattedAmount_2+" "+token1_2+"-->"+token0+" "+formattedAmount_3);
                  }
                }

              }
              
            
          }else{
            //No pools
            
          }
          }
        }

      
    }else{
      // No Pools
    }
  }

}






