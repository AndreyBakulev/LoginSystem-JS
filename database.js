require("dotenv").config();
const { getXataClient } = require("./xata");

const xata = getXataClient();
( async ()=> {
const page = await xata.db.users
  .select([
    "name",
    "email",
    "username",
    "password",
    "salt",
    "accountType",
    "token",
  ])
  .getPaginated({
    pagination: {
      size: 15,
    },
  });

console.log(page.records);
})();
