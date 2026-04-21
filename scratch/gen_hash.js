const bcrypt = require('bcryptjs');
const password = 'Blackstyle01';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log('PASSWORD:', password);
console.log('HASH:', hash);
