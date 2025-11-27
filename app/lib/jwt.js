import jwt from "jwt-simple";

const SECRET = process.env.NEXT_PUBLIC_JWT_SECRET;

export function signToken(payload) {
  return jwt.encode(payload, SECRET);
}

export function verifyToken(token) {
  try {
    return jwt.decode(token, SECRET);
  } catch (err) {
    return null;
  }
}
