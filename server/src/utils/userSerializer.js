function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === "function" ? user.toObject() : user;
  const { passwordHash, ...safeUser } = source;
  return safeUser;
}

module.exports = {
  toPublicUser,
};

