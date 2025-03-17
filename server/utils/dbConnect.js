import mongoose from "mongoose";
import PlayerModel from "../models/Player.js";

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Mongo.');
        // const passwords = ["t1-101", "t2-102", "t3-103", "t4-104", "t5-105"];
    } catch (error) {
        console.log('Unable to connect Mongo.');
    }
}

connectDB();