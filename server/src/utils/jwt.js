const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.email,
    },
    env.jwtSecret,
    {
      expiresIn: "12h",
    }
  );
}

function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
};

