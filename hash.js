const bcrypt = require("bcryptjs");

const password = "donor123"; // you can change this
const hash = bcrypt.hashSync(password, 10);

console.log(hash);
