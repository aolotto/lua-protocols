import inquirer from 'inquirer';
import fs from 'fs'
import { readFileSync } from "node:fs";
import { AO } from "wao"
import { createProjectStructure,createExecutableFromProject } from '../tools/load_lua.js';
import dotenv from "dotenv"

const env_prod = dotenv.parse(fs.readFileSync('.env'))
const env_dev = dotenv.parse(fs.readFileSync('.env.local'))
const packageJSON = fs.readFileSync('package.json', 'utf-8')
const packageData = JSON.parse(packageJSON)
const module = "Do_Uc2Sju_ffp6Ev0AnLVdPtot15rvMjP-a9VVaA5fM"
const scheduler = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA"
const authority = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY"
const token_logos = ['Cbx1FcREFmDz69TnMf0BilUHAVGaz9kp3xM1fOQG9SA','HZlLK9uWlNbhDbxXXe8aPaXZPqq9PKzpdH93ol-BKis']
const src_agent = createExecutableFromProject(createProjectStructure("agent.lua"))
const src_pool = createExecutableFromProject(createProjectStructure("pool.lua"))
const src_token = createExecutableFromProject(createProjectStructure("token.lua"))
const src_faucet = createExecutableFromProject(createProjectStructure("faucet.lua"))
const src_buyback = createExecutableFromProject(createProjectStructure("buyback.lua"))
const src_fundation = createExecutableFromProject(createProjectStructure("fundation.lua"))

inquirer
  .prompt([{
    type:"confirm",
    name: "dev",
    message: "Is those process for dev:",
    default : true
  },{
    type: "input",
    name: "name",
    message: "Set a name for lottery project you deploy: ",
    default : (answers)=>answers.dev?env_dev.LOTTEY_NAME||"aolotto":env_prod.LOTTEY_NAME||"aolotto"
  },{
    type: "input",
    name: "paytoken_pid",
    message: "Enter the TOKEN ID used to pay for the lottery (if empty will spawn a new):",
    default : (answers)=>answers.dev?(env_dev.PAY_ID||"KCAqEdXfGoWZNhtgPRIL0yGgWlCDUl0gvHu8dnE5EJs"):(env_prod.PAY_ID||"7zH9dlMNoxprab9loshv3Y7WG45DOny_Vrq9KrXObdQ"),
  },{
    type: "input",
    name : "agent_pid",
    message: "Enter the AGENT process ID (if empty will spawn a new):",
    default : (answers)=>answers.dev?env_dev.AGENT_ID:env_prod.AGENT_ID,
  },{
    type: "input",
    name : "pool_pid",
    message: "Enter the POOL process ID (if empty will spawn a new):",
    default : (answers)=>answers.dev?env_dev.POOL_ID:env_prod.POOL_ID,
  },{
    type: "input",
    name : "faucet_pid",
    message: "Enter the FAUCET process ID (if empty will spawn a new):",
    default : (answers)=>answers.dev?env_dev.FAUCET_ID:env_prod.FAUCET_ID,
  },{
    type: "input",
    name : "buyback_pid",
    message: "Enter the BACKBACK process ID (if empty will spawn a new):",
    default : (answers)=>answers.dev?env_dev.BUYBACK_ID:env_prod.BUYBACK_ID,
  },{
    type: "input",
    name : "fundation_pid",
    message: "Enter the FUNDATION process ID (if empty will spawn a new):",
    default : (answers)=>answers.dev?env_dev.FUNDATION_ID:env_prod.FUNDATION_ID,
  }])
  .then(async(answers) => {
    const jwk = JSON.parse(readFileSync("../.aos.json").toString());
    const ao = await new AO().init(jwk)
    const signer = ao.toSigner(jwk)
    
    let {name,dev,paytoken_pid,agent_pid,pool_pid,faucet_pid,buyback_pid,fundation_pid} = answers

    // deploy PAY
    if(paytoken_pid.length !== 43){
      const pay = await ao.deploy({
        boot: true,
        src_data: src_token[0],
        fills : {NAME: "tUSDC", TICKER: "USDC", DENOMINATION: 6, LOGO:token_logos[1] },
        tags: {
          Name : `${(name||'aolotto')}-pay${dev?"-dev":""}`,
          Authority : authority,
        }
      })
      console.log("- Spawned PAY process: "+pay.pid)
      paytoken_pid = pay.pid
      await ao.wait(pay.pid)
    }

    // deploy AGENT
    if(agent_pid.length !== 43){
      const agent = await ao.deploy({
        tags: {
          Name : `${(name||'aolotto')}${dev?"-dev":""}`,
          Authority : authority,
          Token : paytoken_pid,
          Ticker : "ALT",
          Denomination : "12"
        },
        loads:[{
          data: src_token[0],
          fills: {NAME: "AoLottoToken", TICKER: "ALT", DENOMINATION: 12, LOGO:token_logos[0] }
        },{
          data: src_agent[0],
          fills: {DEFAULT_PAY_TOKEN_ID: paytoken_pid} 
        }] 
      })
      console.log("- Spawned AGENT process: "+agent.pid)
      agent_pid = agent.pid
      await ao.wait(agent.pid)
    }
    // deploy FAUCET
    if(agent_pid.length == 43 && faucet_pid.length !== 43){
      const faucet = await ao.deploy({
        boot: true,
        src_data: src_faucet[0],
        fills : {AGENT : agent_pid},
        tags: {
          Name : `${(name||'aolotto')}-faucet${dev?"-dev":""}`,
          Authority : authority,
          Agent : agent_pid
        }
      })
      console.log("- Spawned FAUCET process: "+faucet.pid)
      faucet_pid = faucet.pid
      await ao.wait(faucet.pid)
    }

    // deploy POOL
    if(agent_pid.length == 43 && pool_pid.length !== 43){
      const pool = await ao.deploy({
        boot: true,
        src_data: src_pool[0],
        fills : {AGENT : agent_pid},
        tags: {
          Name : `${(name||'aolotto')}-pool${dev?"-dev":""}`,
          ['Cron-Interval']: "1-minute",
          ['Cron-Tag-Action']: "Cron",
          Authority : authority,
          Token : paytoken_pid
        }
      })
      console.log("- Spawned POOL process: "+pool.pid)
      pool_pid = pool.pid
      await ao.wait(pool.pid)
    }

    // deploy BUYBACK
    if(agent_pid.length == 43 && buyback_pid.length !== 43){
      const buyback = await ao.deploy({
        boot: true,
        src_data: src_buyback[0],
        fills : {AGENT : agent_pid},
        tags: {
          Name : `${(name||'aolotto')}-buyback${dev?"-dev":""}`,
          Authority : authority,
          Agent : agent_pid
        }
      })
      console.log("- Spawned BUYBACK process: "+buyback.pid)
      buyback_pid = buyback.pid
      await ao.wait(buyback.pid)
    }

    // deploy FUNDATION
    if(agent_pid.length == 43 && fundation_pid.length !== 43){
      const fundation = await ao.deploy({
        boot: true,
        src_data: src_fundation[0],
        fills : {AGENT : agent_pid},
        tags: {
          Name : `${(name||'aolotto')}-fundation${dev?"-dev":""}`,
          Authority : authority,
          Agent : agent_pid
        }
      })
      console.log("- Spawned FUNDATION process: "+fundation.pid)
      fundation_pid = fundation.pid
      await ao.wait(fundation.pid)
    }

    // save process IDs
    const envText = `LOTTEY_NAME=${name}\nPAY_ID=${paytoken_pid}\nAGENT_ID=${agent_pid}\nFAUCET_ID=${faucet_pid}\nPOOL_ID=${pool_pid}\nFUNDATION_ID=${fundation_pid}\nBUYBACK_ID=${buyback_pid}\n`;
    if(dev){
      fs.writeFileSync(".env.local", envText);
    }else{
      fs.writeFileSync(".env", envText);
    }

     // push those IDs to AGENT
     const e1 = await ao.eval({ 
      pid: agent_pid, 
      data: `
        DEFAULT_PAY_TOKEN_ID = "${paytoken_pid}"
        FUNDATION_ID = "${fundation_pid}"
        FAUCET_ID = "${faucet_pid}"
        BUYBACK_ID = "${buyback_pid}"
        POOL_ID = "${pool_pid}"

        Handlers.syncInfo({
          "${paytoken_pid}",
          "${pool_pid}",
          "${faucet_pid}",
          "${fundation_pid}",
          "${buyback_pid}"
        })
      `  
    })

    if(e1.err){throw(e1.err)}
    console.log("- All the processes linked to AGENT : ",e1.mid)
    
  })
  .catch((error) => {
    if (error.isTtyError) {
      console.log("try error:",error)
    } else {
      console.log(error)
    }
  });
