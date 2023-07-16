# TriArbBot

This project looks for all possible triangular arbitrages from a starting token that is chosen by the user. This is designed such way to utilize the concept of flash loans.

![Screenshot from 2023-07-16 17-31-14](https://github.com/mani99brar/TriArbBot/assets/106914483/dfa19808-c3ce-4efe-9318-d8d77e0fea83)



Contens-
  index.js - Main file 
  oldIndex.sj - Used for farming UniswapV3 pool using logs
  mapping.json - Token pair and tick mapped to pool address

Setup - 

  git clone https://github.com/mani99brar/TriArbBot.git
  cd ./TriArbBot
  npm install
  node index.js
