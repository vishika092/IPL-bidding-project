import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();

import "./utils/dbConnect.js";
import redisClient from "./utils/redisClient.js";

import TeamModel from "./models/Team.js";
import PlayerModel from "./models/Player.js";
import authMiddleware from "./middlewares/auth.js";

const app = express();
const port = process.env.PORT;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(cors());
app.use(express.json());

const timers = {};

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Token not available!'));
        const payload = jwt.verify(token, 'sherl0ck');
        return next();
    } catch (error) {
        return next(new Error('Invalid Token!'));
    }
});


io.on('connection', (socket) => {
    socket.on('bid', async (bidData) => {
        try {
            const { teamid, playerid, amount } = bidData;
            
          console.log(bidData);
          
            const team = await TeamModel.findOne({ teamid });
           

            if (!team) return socket.emit('error', 'Invalid Team ID!');

            const player = await PlayerModel.findOne({ playerid }).populate('teamid');
            if (!player) return socket.emit('error', 'Invalid Player ID!');

           

            if (player.teamid.teamid == teamid || !player.status)
                return socket.emit('error', 'You cannot bid for this Player!');

            if (player.baseprice >= +amount)
                return socket.emit('error', 'Your Bid Amount is too low!');


            if(JSON.parse(await redisClient.get(String(playerid)))?.amount  >= amount){
                return socket.emit('error', 'Your Bid Amount is too low!');
            }
            // Player is onBid
            // const currentBid = await redisClient.get(playerid);

            // if (currentBid && currentBid > amount)
            //     return socket.emit('error', 'Your Bid Amount is too low!');

            await redisClient.set(String(playerid), JSON.stringify({
                amount,
                startTime: Date.now(),
                onBid: true
              }), "EX", 90);

            io.emit('bid-placed', { playerid, teamid, amount,onBid : true });

            // console.log("updating");
            

            if (timers[playerid]) clearTimeout(timers[playerid]);

            timers[playerid] = setTimeout(async () => {
                try {
                    await TeamModel.updateOne(
                        { _id: player.teamid._id },
                        { $pull: { players: player._id } } 
                    );
                    await PlayerModel.updateOne({ playerid }, { teamid: team._id, status: false, currBid : amount });
                    await TeamModel.updateOne(
                        { _id: team._id },
                        { $push: { players: player._id } } 
                    );
                    await redisClient.del(String(playerid))
                    io.emit('update', { playerid, teamid, amount });
                } catch (error) {
                    return socket.emit('error', 'Something Went Wrong!');
                }
            }, 90 * 1000);


        } catch (error) {
            console.log(error);
            return socket.emit('error', 'Something Went Wrong!');
        }
    });
});

app.get('/current-bids', authMiddleware,  async (req, res) => {
    try {
      const keys = await redisClient.keys('*'); 

    console.log(keys);

      const bids = {};
      
      for (const key of keys) {
        const bidData = JSON.parse(await redisClient.get(key));
        const elapsedTime = Date.now() - bidData.startTime;
        const remainingTime = Math.max(0, 90 *1000 - elapsedTime);
  
        bids[key] = {
          ...bidData,
          remainingTime
        };
      }
  
      return res.status(200).json(bids);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Failed to fetch current bids.' });
    }
  });

  
app.get('/', authMiddleware, async (req, res) => {
    try {
        const teamData = await TeamModel.find({}).populate('players');
        return res.status(200).json(teamData);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ msg: 'Internal Server Error!' });
    }
});

app.get('/auth', authMiddleware, (req, res) => {
    const { teamId } = req.team;
    return res.status(200).json({ teamId });
});


app.post('/login', async (req, res) => {
    try {
        const { teamId, password } = req.body;

        const team = await TeamModel.findOne({ teamid: +teamId });
        if (!team)
            return res.status(400).json({ msg: 'Invalid Credentials!' });

        const isPasswdValid = await bcrypt.compare(password, team.password);
        if (!isPasswdValid)
            return res.status(400).json({ msg: 'Invalid Credentials!' });

        const token = jwt.sign({ teamId }, 'sherl0ck', { expiresIn: '4h' });
        return res.status(200).json({ token });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ msg: 'Internal Server Error!' });
    }
});


server.listen(port, () => {
    console.log('Server running at', port);
});