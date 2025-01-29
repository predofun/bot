import mongoose from "mongoose";
import { env } from "./environment";

export const connectDb = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      directConnection: true,
      readPreference: 'primary'
    });

    console.log("MongoDB Connected: " + conn.connection.host);
    return conn.connection.host;
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
