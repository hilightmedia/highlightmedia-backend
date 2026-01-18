import bcrypt from "bcrypt";
import { env } from "../config/env";


export const hashValue = async (value: string): Promise<string> => {
  return bcrypt.hash(value, env.BCRYPT_SALT_ROUNDS);
};


export const compareValue = async (
  value: string,
  hashedValue: string
): Promise<boolean> => {
  return bcrypt.compare(value, hashedValue);
};
