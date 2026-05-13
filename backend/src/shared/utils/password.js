import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export async function hashPassword(password) {
  return bcrypt.hash(password, getBcryptSaltRounds());
}

export async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function getBcryptSaltRounds() {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS);

  if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 15) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 15');
  }

  return saltRounds;
}
